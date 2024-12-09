module.exports = {
    routes: [
      {
        method: 'GET',
        path: '/places',
        handler: 'places.getNearbyPlaces',
        config: {
          policies: [],
          middlewares: [],
        },
      },
    ],
  };
  