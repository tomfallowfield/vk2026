'use strict';

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::site-setting.site-setting', {
  only: ['find', 'update'],
  config: {
    find: { auth: false },
    update: { auth: { scope: ['api::site-setting.site-setting.update'] } }
  }
});
