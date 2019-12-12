'use strict';

const express = require('express');
const app = express();
const cors = require('cors');
const superagent = require('superagent');


const PORT = process.env.PORT || 3000;

// Load ENV
require('dotenv').config();

app.use(cors());

//Routes
app.get('/', (request, response) => {
  response.send('What up, fam!');
});

app.get('/location', getLocation);
app.get('/weather', getWeather);
app.get('/events', searchEvents);

//Handlers
function getLocation(request, response){
  return searchLatToLng(request.query.data || 'lynwood')
    .then(locationData => {
      response.send(locationData);

    })
}

function getWeather(request, response){
  return searchWeather(request.query.data || 'Lynnwood, WA, USA')
    .then(weatherData => {
      response.send(weatherData);
    })
}

// function getEvent(request, response){
//   return searchEvents(request.query.data)
//     .then(eventData => {
//       response.send(eventData);
//     })

// }

// let weatherLocations = [];

//Constructors
function Location(location){
  this.formatted_query = location.formatted_address;
  this.latitude = location.geometry.location.lat;
  this.longitude = location.geometry.location.lng;
  this.long_name = location.address_components[0].long_name;

  // weatherLocations.push(this.latitude);
  // weatherLocations.push(this.longitude);
}

function Daily(dailyForecast){
  this.forecast = dailyForecast.summary;
  // console.log('what', dailyForecast.summary);
  this.time = new Date(dailyForecast.time * 1000).toDateString();
}

function Eventful(event){
  this.link = event.url;
  this.name = event.title;
  this.event_date = event.start_time;
  this.summary = event.description;

}

//Search for location data
function searchLatToLng(query){
  const geoDataUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODING_API_KEY}`
  return superagent.get(geoDataUrl)

    .then(geoData => {
      // console.log('hey',geoData)


      const location = new Location(geoData.body.results[0]);
      console.log('what', geoData.body.results)
      return location;
    })
    .catch(err => console.error(err))
  // const geoData = require('./data/geo.json');
}

// Search for Weather data
function searchWeather(query){
  const darkSkyDataUrl = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${query.latitude},${query.longitude}`
  // let darkSkyData = require('./data/darksky.json');
  return superagent.get(darkSkyDataUrl)
    .then(weatherData => {

      let weatheArray = [];
      weatherData.body.daily.data.map(forecast => weatheArray.push(new Daily(forecast)));
      // console.log(weatheArray);
      return weatheArray;
    })
}

// Search for events
function searchEvents(request, response){
  const eventsDataUrl = `http://api.eventful.com/json/events/search?location=${request.query.data.formatted_query}&app_key=${process.env.EVENTBRITE_API_KEY}`
  return superagent.get(eventsDataUrl)
    .then(eventData => {
      const jsonData = JSON.parse(eventData.text)
      const events = jsonData.events.event;
      let eventArray = [];
      events.map(event => eventArray.push(new Eventful(event)));

      response.send(eventArray);
      console.log('did', jsonData.events.event)

    })
}

//Error handler
app.get('/*', function(request, response){
  response.status(404).send('Try again!')
})

app.listen(PORT, () => {
  console.log(`app running on PORT: ${PORT}`);
});