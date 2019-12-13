'use strict';

const express = require('express');
const app = express();
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');



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
app.get('/movies', searchMovie);

//postgres
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('error', err => console.error(err));

//Handlers
function getLocation(request, response){
  let searchHandler = {
    cacheHit: (data) => {
      console.log('from the database');
      response.status(200).send(data);
    },
    cacheMiss: (query) => {
      return searchLatToLng(query)
        .then(result => {
          response.send(result);
        }).catch(err=>console.error(err));
    }
  }
  lookUpLocation(request.query.data, searchHandler);
  // return searchLatToLng(request.query.data || 'lynwood')
  //   .then(locationData => {
  //     response.send(locationData);
  //   })
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
  this.short_name= location.address_components[0].short_name;
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
function Movies(movie){
  this.title = movie.title;
  this.overview = movie.overview;
  this.averageVotes = movie.vote_average;
  this.totalVotes = movie.vote_count;
  this.image_url = movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '';
  this.popularity = movie.popularity;
  this.releasedOn = movie.release_date;
 
}


// searching location from SQL
function lookUpLocation(query, handler){
  const SQL = 'SELECT * FROM locations WHERE search_query=$1';
  const values = [query];
  console.log(values);
  return client.query(SQL, values)
    .then(data => {
      if(data.rowCount){
        console.log('retrieved from database');
        handler.cacheHit(data.rows[0])
      } else {
        handler.cacheMiss(query);
      }
    })
    .catch(err => console.error(err));

}

//Search for location data
function searchLatToLng(query){
  const geoDataUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODING_API_KEY}`
  return superagent.get(geoDataUrl)

    .then(geoData => {
      console.log('hey from google',geoData)


      const location = new Location(geoData.body.results[0]);
      let SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES($1, $2, $3, $4) RETURNING id`;

      //store it in our DB
      return client.query(SQL, [query, location.formatted_query, location.latitude, location.longitude])
        .then((result) =>{
          console.log(result);
          console.log('stored to DB');
          location.id = result.rows[0].id
          // console.log('what', geoData.body.results)
          return location;
        })
        .catch(err => console.error(err))
      // const geoData = require('./data/geo.json');
    })
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

function searchMovie(request, response){
  const movieDataUrl = `https://api.themoviedb.org/3/search/movie?query= ${request.query.data.search_query}&api_key=${process.env.MOVIE_API_KEY}`
  // let darkSkyData = require('./data/darksky.json');
  return superagent.get(movieDataUrl)
    .then(movieData => {
      const parsedMovieData = JSON.parse(movieData.text);
      let movieArray = [];
      parsedMovieData.results.map(movie => movieArray.push(new Movies(movie)));
      console.log('movie array: ',movieArray);
     
      response.send(movieArray);
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
      // console.log('did', jsonData.events.event)

    })
}

//Error handler
app.get('/*', function(request, response){
  response.status(404).send('Try again!')
})

app.listen(PORT, () => {
  console.log(`app running on PORT: ${PORT}`);
});
