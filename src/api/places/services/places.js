const axios = require('axios');

module.exports = {
  async fetchNearbyPlaces(latitude, longitude, apiKey) {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=1000&key=${apiKey}`;
    const response = await axios.get(url);
    return response.data;
  },
};
