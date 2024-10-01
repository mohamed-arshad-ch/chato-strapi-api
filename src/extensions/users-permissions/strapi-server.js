// ./src/extensions/users-permissions/strapi-server.js

module.exports = (plugin) => {
    // Save the original register controller
    const originalRegister = plugin.controllers.auth.register;
  
    // Override the register controller
    plugin.controllers.auth.register = async (ctx) => {
      // Call the original register function
      await originalRegister(ctx);
  


      // Check if the registration was successful
      if (ctx.response.status === 200) {
        // Customize the response
        
        ctx.body = {
          status: 'success',
          message: 'User registered successfully',
          user: ctx.body.user, // Include user data if needed
          jwt: ctx.body.jwt,   // Include JWT token if needed
        };
      } else {
        // Handle errors if necessary
        ctx.body = {
          status: 'error',
          message: 'Registration failed',
          error: ctx.body.error,
        };
      }
    };
  
    // Save the original login controller
    const originalLogin = plugin.controllers.auth.callback;
  
    // Override the login controller
    plugin.controllers.auth.callback = async (ctx) => {
      // Call the original login function
      await originalLogin(ctx);
  
      // Check if the login was successful
      if (ctx.response.status === 200) {
        // Customize the response
        ctx.body = {
          status: 'success',
          message: 'User logged in successfully',
          user: ctx.body.user, // Include user data if needed
          jwt: ctx.body.jwt,   // Include JWT token if needed
        };
      } else {
        // Handle errors if necessary
        ctx.body = {
          status: 'error',
          message: 'Login failed',
          error: ctx.body.error,
        };
      }
    };
  
    return plugin;
  };
  