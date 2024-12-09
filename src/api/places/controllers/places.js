const placesService = require('../services/places');

module.exports = {
  async getNearbyPlaces(ctx) {
    const { latitude, longitude } = ctx.query;

    if (!latitude || !longitude) {
      return ctx.badRequest('Latitude and longitude are required.');
    }

    try {
      const data = await placesService.fetchNearbyPlaces(latitude, longitude, 'YOUR_GOOGLE_API_KEY');
      return ctx.send(data);
    } catch (error) {
      console.error('Error fetching Google Places API:', error.message);
      return ctx.internalServerError('Unable to fetch nearby places.');
    }
  },
};
