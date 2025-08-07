const axios = require('axios');

exports.handler = async function(context, event, callback) {
  console.log("Received Event:", JSON.stringify(event, null, 2));

  try {
    const rawZip = event.args?.zip_code
                  || event.zip_code
                  || event.properties?.zip_code
                  || "";
    console.log("Raw ZIP input:", rawZip);
    if (!/^\d{5}$/.test(rawZip.trim())) {
      console.error("Missing or invalid ZIP code.");
      return callback("Missing or invalid ZIP code.");
    }
    const zip = rawZip.trim();

    async function fetchParks(z) {
      const distances = [50, 100];
      for (const miles of distances) {
        const url = `https://parksapi-test.urbanairparks.com/parks-service/parks/search` +
                    `?location=${z}&distanceInMiles=${miles}&top=3&brandId=1`;
        console.log(`▶ Fetching parks within ${miles} miles for ZIP ${z}`);
        const resp = await axios.get(url);
        const list = resp.data?.data;
        if (Array.isArray(list) && list.length > 0) {
          return list;
        }
        console.warn(`No parks found within ${miles} miles, retrying…`);
      }
      throw new Error("No parks found in any radius");
    }

    function normalizePark(p) {
      const roundedMiles = `${Math.round(p.distanceInMiles)} miles`;
      const addr = p.address;
      const fullAddr = `${addr.streetAddress} ${addr.city}, ${addr.state}, ${addr.zipCode}.`;
      return {
        name:               p.name,
        distance:           roundedMiles,
        timezone:           p.timezone,
        phoneNumber:        p.phoneNumber,
        address:            fullAddr,
        slug:               p.urlSlug,
        id:                 p.id
      };
    }

    const parks = await fetchParks(zip);
    parks.sort((a, b) => a.distanceInMiles - b.distanceInMiles);
    const [nearest, backup1, backup2] = parks;

    const n = normalizePark(nearest);
    const b1 = backup1 ? normalizePark(backup1) : {};
    const b2 = backup2 ? normalizePark(backup2) : {};

    const next_steps = 
      `Confirm the nearest park ${n.name} with the caller. Say: ` +
      `'It looks like the nearest park to you is ${n.name}, which is about ${n.distance} ` +
      `away from you. Does that sound okay?'`;

    const response = {
      nearest_park: {
        nearest_park:             n.name,
        nearest_park_distance:    n.distance,
        nearest_park_timezone:    n.timezone,
        nearest_park_phone_number: n.phoneNumber,
        nearest_park_address:     n.address,
        nearest_park_slug:        n.slug,
        nearest_park_id:          n.id,
      },
      back_up_park_one: b1 ? {
        back_up_park_one:        b1.name,
        back_up_park_one_distance:    b1.distance,
        back_up_park_one_timezone:    b1.timezone,
        back_up_park_one_phone_number: b1.phoneNumber,
        back_up_park_one_address:     b1.address,
        back_up_park_one_slug:        b1.slug,
        back_up_park_one_id:          b1.id,
      } : {},
      back_up_park_two: b2 ? {
        back_up_park_two:        b2.name,
        back_up_park_two_distance:    b2.distance,
        back_up_park_two_timezone:    b2.timezone,
        back_up_park_two_phone_number: b2.phoneNumber,
        back_up_park_two_address:     b2.address,
        back_up_park_two_slug:        b2.slug,
        back_up_park_two_id:          b2.id,
      } : {},
      next_steps
    };

    console.log("Returning response:", JSON.stringify(response.nearest_park), JSON.stringify(response.back_up_park_one), JSON.stringify(response.back_up_park_two), JSON.stringify(response.next_steps));
    return callback(null, response);

  } catch (err) {
    console.error("Handler error:", err);
    return callback(null, {
      next_steps: 
        "Advise the caller that no parks were found, and try again with a new zip code. " +
        "Say: 'There doesn't seem to be any parks within an hour of your zip code. " +
        "Do you have another zip code in mind?'"
    });
  }
};
