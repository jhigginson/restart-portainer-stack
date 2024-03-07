#!/usr/bin/env node
import 'dotenv/config'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import fetch from 'node-fetch';

const urlBase = process.env.PORTAINER_BASEURL;
const user = process.env.PORTAINER_USER;
const password = process.env.PORTAINER_PASSWORD;
const stackName = process.env.STACKNAME;

async function authenticatePortainer() {

  const auth = JSON.stringify({
    username: user,
    password: password
  });

  const response = await fetch(urlBase + "/api/auth", {
    method: 'post', body: auth, headers: {
      'Content-Type': 'application/json',
      'Content-Length': auth.length,
    }
  });

  const authData = await response.json();

  if ("jwt" in authData) {
    console.log("Authentication successfull");
    return authData.jwt;
  } else {
    throw new Error(`/api/auth POST message: ${"message" in authData && authData.message} details: ${"details" in authData && authData.details}`);
  }

};

async function getStackByName(token, stackName) {
  const response = await fetch(urlBase + "/api/stacks",
    {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
      }
    });
  const stacks = await response.json();
  if ("length" in stacks && stacks.length > 0) {
    return stacks.filter(s => s.Name === stackName)[0];
  }
  else if ("length" in stacks && stacks.length === 0) {
    throw new Error(`Couldn't find any stacks with name ${stackName}`);
  } else {
    throw new Error(`/api/stacks GET message: ${"message" in stacks && stacks.message} details: ${"details" in stacks && stacks.details}`)
  }
};

async function controlStack(token, stackId, action) {
  const response = await fetch(`${urlBase}/api/stacks/${stackId}/${action}`,
    {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + token,
      }
    });
  const stack = await response.json();

  if (response.status === 200) {
    console.log(`Successfully ${action === "stop" ? "stopped" : action === "start" ? "started" : "?"} ${stack.Name}`);
    return true;
  } else {
    throw new Error(`/api/stacks/${stackId} GET message: ${"message" in stack && stack.message} details: ${"details" in stack && stack.details}`);
  }
}

console.log(new Date().toString());

console.log(`Attempting to connect to portainer instance on ${urlBase}`);
const authToken = await authenticatePortainer();

const stack = await getStackByName(authToken, stackName);

if (stack.Status === 1 && await controlStack(authToken, stack.Id, "stop")) {  //Status:1 => active, Status:2 => inactive
  let attempts = 10;
  while (await getStackByName(authToken, "mediastack").Status === 1 && attempts >= 0) {
    if (attempts === 0) {
      throw new Error("Timed-out waiting for stack to go inactive. Exiting.");
    }
    const end = Date.now() + 6000;
    while (Date.now() < end);
    attempts--;
  }
}

await controlStack(authToken, stack.Id, "start");
