const axios = require('axios');

exports.handler = async function(context, event, callback) {
  console.log("Received Event:", JSON.stringify(event, null, 2));

  try {
    const rawLoc = event.args?.park_location
                 || event.park_location
                 || event.properties?.park_location
                 || "";
    if (typeof rawLoc !== 'string' || !rawLoc.trim()) {
      console.error("Missing or invalid park_location.");
      return callback("Missing or invalid park_location. We need a valid US City and State.");
    }
    const parkLoc = rawLoc.trim();

    async function listAllParks() {
      const url = 'https://unleashedapi-test.urbanairparks.com/brands/1/parks';
      console.log("Fetching full park list");
      const resp = await axios.get(url);
      const listResponse = resp.data?.data;
      if (!Array.isArray(listResponse)) {
        console.error("Got back:", resp.data);
        throw new Error("Unexpected list response format");
      }
      return listResponse;
    }

    function findByName(list, name) {
      return list.find(p => p.name.toLowerCase() === name.toLowerCase());
    }
    
    const allParks = await listAllParks();
    const matched   = findByName(allParks, parkLoc);
    if (!matched) {
      return callback(null, {
        next_steps:
          `Advise the caller that "${parkLoc}" couldn't be validated and switch to the zip code flow. Say: ` +
          `'I’m sorry, I couldn't find a park named ${parkLoc}. ` +
          `Let's try a different approach. What's your five digit code?'`
      });
    }

    const zip = matched.address.zipCode;
    async function fetchNearby(z) {
      const url =
        `https://parksapi-test.urbanairparks.com/parks-service/parks/search` +
        `?location=${z}&distanceInMiles=100&top=3&brandId=1`;
      console.log(`Fetching nearby parks for ZIP ${z}`);
      const resp = await axios.get(url);
      const list = resp.data?.data;
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error("No parks found within 100 miles");
      }
      return list;
    }

    function normalizePark(p) {
      const miles = `${Math.round(p.distanceInMiles)} miles`;
      const a = p.address;
      const addr = `${a.streetAddress} ${a.city}, ${a.state}, ${a.zipCode}.`;
      return {
        name:        p.name,
        distance:    miles,
        timezone:    p.timezone,
        phoneNumber: p.phoneNumber,
        address:     addr,
        slug:        p.urlSlug,
        id:          p.id
      };
    }

    const nearby = await fetchNearby(zip);
    nearby.sort((a, b) => a.distanceInMiles - b.distanceInMiles);
    const [ nP, bP1, bP2 ] = nearby.map(normalizePark);

    const next_steps =
      `The park ${nP.name} has been successfully validated. ` +
      `Confirm the park address. (Fill in the correct values below. Translate abbreviations into full words.) ` +
      `Say: 'Great, found it! This is our ${nP.name} location at [Street Address]. Zip Code: [Zip Code]. Does that address sound okay?.'`;

    const response = {
      nearest_park:       { ...nP },
      back_up_park_one:   bP1 ? { ...bP1 } : {},
      back_up_park_two:   bP2 ? { ...bP2 } : {},
      next_steps
    };

    console.log("Returning response:", JSON.stringify(response, null, 2));
    return callback(null, response);

  } catch (err) {
    console.error("Handler error:", err);
    // any other failure
    return callback(null, {
      next_steps:
        "Something went wrong validating the park location, try using the zip code flow. Say: " +
        "'I’m sorry, I wasn't able to find your park. Let's try a different approach. What's your five digit code?'"
    });
  }
};
