'use strict';

/**
 * message router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::message.message');
// ./src/api/message/routes/message.js

module.exports = {
    routes: [
// ...existing routes
        {
            method: 'POST',
            path: '/messages',
            handler: 'message.create',
            config: {
              auth: {
                required: true,
              },
            },
          },


      
      {
        method: 'GET',
        path: '/messages/chat-users',
        handler: 'message.getChatUsers',
        config: {
          auth: {
            required: true,
          },
        },
      },


      {
        method: 'GET',
        path: '/messages/to/:receiverUserId',
        handler: 'message.getMessagesWithUser',
        config: {
          auth: {
            required: true,
          },
        },
      },

      {
        method: 'POST',
        path: '/messages/mark-as-read',
        handler: 'message.markMessagesAsRead',
        config: {
          auth: {
            required: true,
          },
        },
      },


      {
        method: 'GET',
        path: '/messages/all-users',
        handler: 'message.getAllLoginUsers',
        config: {
          auth: {
            required: true,
          },
        },
      },

      {
        method: 'POST',
        path: '/messages/voice',
        handler: 'message.voice',
        config: {
          auth: {
            required: true,
          },
        },
      },


    ],
  };
  