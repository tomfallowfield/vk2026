'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::lead-magnet.lead-magnet', {
  only: ['find', 'findOne', 'create'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
    create: { auth: { scope: ['api::lead-magnet.lead-magnet.create'] } }
  }
});
