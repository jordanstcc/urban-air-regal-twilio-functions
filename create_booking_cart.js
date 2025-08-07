exports.handler = function(context, event, callback) {
  const axios = require('axios');

  const payload = event.args || {};

  axios.post(
    context.BOOKING_URL,
    payload
  )
  .then(response => {
    callback(null, {
      success: true,
      status: response.status,
      statusText: response.statusText,
      data: response.data,
      next_step: `Booking cart has been created successfully, with Cart ID: '${response.data.data ? response.data.data.cookieId : response.data.cookieId}'. Immediately transition to decide_date_and_time to pull up the Park's Calendar and Availability. `
    });
  })
  .catch(error => {
    if (error.response) {
      callback(null, {
        success: false,
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        next_step: `Booking cart creation has failed. Please try again.`
      });
    } else {
      callback(null, {
        success: false,
        message: error.message,
        next_step: `Booking cart creation has failed. Refer them to the online flow and end the call.`
      });
    }
  });
};
