'use strict';

/**
 * message controller
 */

const { createCoreController } = require('@strapi/strapi').factories;
const { sanitize } = require('@strapi/utils');

module.exports = createCoreController('api::message.message', ({ strapi }) => ({

    getConversationRoomId(userId1, userId2) {
        const sortedIds = [userId1, userId2].sort();
        return `conversation_${sortedIds[0]}_${sortedIds[1]}`;
      },


    // Override the default find method
    async find(ctx) {

        // Get the authenticated user from the context
    const user = ctx.state.user;

    // Check if the user is authenticated
    if (!user) {
      return ctx.unauthorized('You must be logged in to view your messages.');
    }

    
       // Fetch messages that belong to the authenticated user
    const messages = await strapi.entityService.findMany('api::message.message', {
        filters: {
            created_user: {
            id: user.id,
          },
        },
        populate: {
          created_user: {
            fields: ['username', 'email'],
          },
        },
      });
  
      // Return the filtered messages
      ctx.body = messages;
      },
  
  

      async getChatUsers(ctx) {
        try {
          const user = ctx.state.user;
          if (!user) {
            return ctx.unauthorized('You must be logged in to view your chats.');
          }
          const userId = user.id;
    
          // Fetch messages where the user is the sender or recipient
          const messages = await strapi.entityService.findMany('api::message.message', {
            filters: {
              $or: [
                { created_user: userId },
                { received_user: userId },
              ],
            },
            populate: {
              created_user: { fields: ['id', 'username'] },
              received_user: { fields: ['id', 'username'] },
            },
            sort: { createdAt: 'desc' },
            limit: -1, // Fetch all messages
          });
    
          // Organize messages by conversation and get the last message per user and unread counts
          const conversations = {};
          messages.forEach((message) => {
            const senderId = message.created_user?.id;
            const recipientId = message.received_user?.id;
            const otherUserId = senderId === userId ? recipientId : senderId;
    
            if (!otherUserId) return;
    
            if (!conversations[otherUserId]) {
              conversations[otherUserId] = {
                user: senderId === userId ? message.received_user : message.created_user,
                lastMessage: {
                  content: message.content,
                  duration:message.duration > 0 ? message.duration : null,
                  createdAt: message.createdAt,
                },
                unreadCount: 0,
              };
            }
    
            // Count unread messages where the authenticated user is the receiver and message is not read
            if (
              message.received_user.id === userId &&
              message.created_user.id === otherUserId &&
              !message.isRead
            ) {
              conversations[otherUserId].unreadCount += 1;
            }
          });
    
          // Convert conversations object to an array
          const chatUsers = Object.values(conversations);
    
          // Return the list of users with the last message and unread counts
          ctx.body = chatUsers;
        } catch (err) {
          strapi.log.error('Error fetching chat users:', err);
          ctx.internalServerError('An error occurred while fetching chat users.');
        }
      },


      /**
   * Custom action to get all messages sent by the authenticated user to a specific receiver.
   * @param {Object} ctx - The Koa context object.
   */
      async getMessagesWithUser(ctx) {
        try {
          // Step 1: Get the authenticated user
          const authenticatedUser = ctx.state.user;
          if (!authenticatedUser) {
            return ctx.unauthorized('You must be logged in to access this resource.');
          }
    
          // Step 2: Get the other user ID from the request parameters
          const { receiverUserId } = ctx.params;
          if (!receiverUserId) {
            return ctx.badRequest('User ID is required.');
          }
    
          // Validate that otherUserId is a valid integer
          const targetUserId = parseInt(receiverUserId, 10);
          if (isNaN(targetUserId)) {
            return ctx.badRequest('Invalid user ID.');
          }
    
          // Optional: Check if the other user exists
          const otherUser = await strapi.entityService.findOne('plugin::users-permissions.user', targetUserId, {
            fields: ['id', 'username'],
          });
          if (!otherUser) {
            return ctx.notFound('User not found.');
          }
    
          // Step 3: Fetch messages between the authenticated user and the specified user
          const messages = await strapi.entityService.findMany('api::message.message', {
            filters: {
              $or: [
                {
                  created_user: authenticatedUser.id,
                  received_user: receiverUserId,
                },
                {
                  created_user: receiverUserId,
                  received_user: authenticatedUser.id,
                },
              ],
            },
            populate: {
              created_user: {
                fields: ['id', 'username'],
              },
              received_user: {
                fields: ['id', 'username'],
              },
            },
            sort: { createdAt: 'asc' }, // You can choose 'asc' or 'desc' based on your preference
            limit: -1, // Fetch all matching messages
          });
    
          // Step 4: Return the messages
          ctx.body = { data: messages };
        } catch (error) {
          strapi.log.error('Error fetching messages with user ID:', error);
          ctx.internalServerError('An error occurred while fetching messages.');
        }
      },



       /**
   * Custom action to create a message where the created_user is the authenticated user.
   * @param {Object} ctx - The Koa context object.
   */
       async create(ctx) {
        try {
          const authenticatedUser = ctx.state.user;
          if (!authenticatedUser) {
            return ctx.unauthorized('You must be logged in to send a message.');
          }
    
          const { received_user, content } = ctx.request.body;
    
          if (!received_user) {
            return ctx.badRequest('received_user ID is required.');
          }
          if (!content) {
            return ctx.badRequest('Message content is required.');
          }
    
          const recipientUser = await strapi.entityService.findOne('plugin::users-permissions.user', received_user, {
            fields: ['id', 'username'],
          });
          if (!recipientUser) {
            return ctx.notFound('Recipient user not found.');
          }
    
          const messageData = {
            content,
            created_user: authenticatedUser.id,
            received_user: received_user,
            isRead: false,
            data_type:"text"
          };
    
          const newMessage = await strapi.entityService.create('api::message.message', {
            data: messageData,
            populate: {
              created_user: { fields: ['id', 'username'] },
              received_user: { fields: ['id', 'username'] },
            },
          });
    
          // Emit the message via Socket.IO
          if (strapi.io) {
            const roomId = this.getConversationRoomId(
              newMessage.created_user.id,
              newMessage.received_user.id
            );
            strapi.io.to(roomId).emit('new_message', newMessage);
    
            // Also emit to the recipient's personal room
            strapi.io.to(`user_${received_user}`).emit('new_message', newMessage);
          } else {
            strapi.log.warn('Socket.IO is not initialized');
          }
    
          ctx.created(newMessage);
        } catch (error) {
          strapi.log.error('Error creating message:', error);
          ctx.internalServerError('An error occurred while sending the message.');
        }
      },
    
      async markMessagesAsRead(ctx) {
        try {
          const authenticatedUser = ctx.state.user;
          if (!authenticatedUser) {
            return ctx.unauthorized('You must be logged in to mark messages as read.');
          }
    
          const { otherUserId } = ctx.request.body;
          if (!otherUserId) {
            return ctx.badRequest('otherUserId is required.');
          }
    
          // Update messages as read
          await strapi.db.query('api::message.message').updateMany({
            filters: {
              created_user: otherUserId,
              received_user: authenticatedUser.id,
              isRead: false,
            },
            data: {
              isRead: true,
            },
          });
    
          // Notify the sender that messages have been read
          if (strapi.io) {
            strapi.io.to(`user_${otherUserId}`).emit('messages_read', {
              userId: authenticatedUser.id,
            });
          }
    
          ctx.body = { success: true };
        } catch (error) {
          strapi.log.error('Error marking messages as read:', error);
          ctx.internalServerError('An error occurred while marking messages as read.');
        }
      },
  

    /**
   * Custom action to get all users.
   * @param {Object} ctx - The Koa context object.
   */
  async getAllLoginUsers(ctx) {
    try {
      // Ensure the user is authenticated
      const authenticatedUser = ctx.state.user;
      if (!authenticatedUser) {
        return ctx.unauthorized('You must be logged in to access this resource.');
      }

      // Fetch all users
      const users = await strapi.entityService.findMany('plugin::users-permissions.user', {
        fields: ['id', 'username', 'email'], // Include the fields you need
        limit: -1, // Fetch all users
      });

      // Return the list of users
      ctx.body = users;
    } catch (error) {
      strapi.log.error('Error fetching all users:', error);
      ctx.internalServerError('An error occurred while fetching users.');
    }
  },
  

  async voice(ctx) {
    let entity;

    // Ensure the request is multipart/form-data
    if (!ctx.is('multipart')) {
      return ctx.badRequest('Content-Type must be multipart/form-data');
    }

    // Access files and body data directly
    const { received_user,duration } = ctx.request.body;
    const { file } = ctx.request.files;

    // Validate required fields
    if (!received_user) {
      return ctx.badRequest('received_user is required');
    }

    if (!file) {
      return ctx.badRequest('Audio file is required');
    }

    try {
      // Upload the audio file using Strapi's Upload plugin
      const uploadedFiles = await strapi.plugins['upload'].services.upload.upload({
        data: {}, // Additional data if needed
        files: file,
      });

      console.log(uploadedFiles);
      
      // Ensure a file was uploaded
      if (!uploadedFiles || uploadedFiles.length === 0) {
        return ctx.badRequest('Failed to upload audio file');
      }

      // Get the URL of the uploaded audio file
      const audioUrl = uploadedFiles[0].url;
console.log(audioUrl);

      // Create a new message entity with type 'audio'
      entity = await strapi.entityService.create('api::message.message', {
        data: {
          data_type: 'voice', // Ensure your Message content type has a 'type' field
          content: `http://localhost:1337${audioUrl}`, // URL of the uploaded audio
          created_user: ctx.state.user.id, // ID of the sender
          received_user: received_user, // ID of the receiver
          isRead: false,
          duration:duration
        },
        populate: {
            created_user: { fields: ['id', 'username'] },
            received_user: { fields: ['id', 'username'] },
          },
      });

      // Sanitize the response
      

      // Determine the room ID based on user IDs
    
      // Emit the new message to the receiver's room via Socket.IO
      if (strapi.io) {
        const roomId = `conversation_${Math.min(ctx.state.user.id, received_user)}_${Math.max(ctx.state.user.id, received_user)}`;
        strapi.io.to(roomId).emit('new_message', entity);
        strapi.io.to(`user_${received_user}`).emit('new_message', entity);
        console.log("entity",entity);
        
      }

      return entity;

    } catch (error) {
      strapi.log.error('Error uploading voice message:', error);
      return ctx.internalServerError('An error occurred while uploading the voice message.');
    }
  },

  }));

