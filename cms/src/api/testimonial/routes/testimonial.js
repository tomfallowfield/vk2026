'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::testimonial.testimonial', {
  only: ['find', 'findOne', 'create'],
  config: {
    find: { auth: false },
    findOne: { auth: false },
    create: { auth: { scope: ['api::testimonial.testimonial.create'] } }
  }
});
