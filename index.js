// ------------------
// Global variables
// ------------------

// The id's of some elements
const SELECT_TRAIN_ID = 'select-train';
const SELECT_DETECT_ID = 'select-detect';
const CONTAINER_TRAIN_ID = 'train-container';
const CONTAINER_DETECT_ID = 'detect-container';
const TRAIN_PASSWORD_ID = 'train-password-input';
const TRAIN_NAME_ID = 'train-name-input';
const TRAIN_BUTTON_ID = 'train-button';
const SAVE_PASSWORD_BUTTON_ID = 'save-password-button';
const DETECT_BUTTON_ID = 'detect-button';
const DETECT_PASSWORD_ID = 'detect-password-input';
const INFORMATION_ID = 'number-passwords-typed-info';
const TRAINING_FINISHED_ID = 'training-finished-info';
const OUTPUT_BOX_ID = 'output-article';
const OUTPUT_ID = 'output-div';

// Some variables
let data = {}; // {'name': [password_timesteps_1, password_timesteps_2, ...], ...}
const PASSWORD = 'password';
const MINIMUM_TYPED_PASSWORD = 5; // Minimum number that everyone has to type the password
let passwordWord = '';
let passwordTimes = [];
let indexToUser = {}; // Back and forth between index and username
let model; // The neural network

// ------------------
// TensorFlow
// ------------------

async function cleanupData() {
  // Make all arrays the same length so that the net can learn them

  let maxLength = 0;
  // First get the largest array size
  for (const name in data) {
    if (data[name].length > maxLength) {
      maxLength = data[name].length;
    }
  }
  // Then fill all other to have the same length by looping the data
  for (const name in data) {
    if (data[name].length < maxLength) {
      const length = data[name].length;
      for (let i = 0; i < maxLength - length; i++) {
        data[name].push(data[name][i % length]);
      }
    }
  }
}

async function trainNeuralNetwork() {
  await cleanupData();
  console.log('Training...');
  // Add training loop to button
  document.getElementById(TRAIN_BUTTON_ID).classList.add('is-loading');

  // Convert the data object to arrays
  let x_array = [];
  let y_array = [];
  let i = 0;
  const numUser = Object.keys(data).length;
  for (const [key, value] of Object.entries(data)) {
    value.forEach((v) => {
      x_array.push(v);
      let y = new Array(numUser).fill(0);
      y[i] = 1;
      y_array.push(y);
    });
    indexToUser[i] = key;
    i++;
  }

  const xs = tf.tensor2d(x_array, [x_array.length, PASSWORD.length - 1]);
  const ys = tf.tensor2d(y_array, [y_array.length, numUser]);

  // Create the model
  model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [PASSWORD.length - 1],
        units: 32,
        activation: 'tanh',
      }),
      tf.layers.dense({ units: 16, activation: 'tanh' }),
      tf.layers.dense({ units: i, activation: 'softmax' }),
    ],
  });

  // Compile the model
  model.compile({ loss: 'meanSquaredError', optimizer: 'adam' });

  // Train the model using the data.
  await model.fit(xs, ys, { epochs: 250 });

  // Enable the detection and show that
  document.getElementById(DETECT_BUTTON_ID).removeAttribute('disabled');
  document.getElementById(DETECT_PASSWORD_ID).removeAttribute('disabled');
  document.getElementById(TRAINING_FINISHED_ID).classList.remove('is-hidden');

  // Remove training loop to button
  document.getElementById(TRAIN_BUTTON_ID).classList.remove('is-loading');
}

function detectWithNeuralNetwork(passwordTimesteps) {
  // Predict the data with the time measured
  const prediction = model
    .predict(tf.tensor2d(passwordTimesteps, [1, PASSWORD.length - 1]))
    .dataSync();
  console.log(`Prediction is: ${prediction}`);
  const predictedIdx = tf.argMax(tf.softmax(prediction)).dataSync();

  // Show the prediction
  document.getElementById(OUTPUT_BOX_ID).classList.remove('is-hidden');
  document.getElementById(
    OUTPUT_ID
  ).innerHTML = `Probably <b>${indexToUser[predictedIdx]}</b> typed the password.`;
}

// ------------------
// UI Functions
// ------------------
function savePassword() {
  const passwordTimesteps = [];
  const name = document.getElementById(TRAIN_NAME_ID).value.toLowerCase();

  // Remove the warnings if there were some
  document.getElementById(TRAIN_NAME_ID).classList.remove('is-danger');
  document.getElementById(TRAIN_PASSWORD_ID).classList.remove('is-danger');

  // If the password doesn't start with the correct word or no name is given, make inputs red
  if (!passwordWord.startsWith(PASSWORD)) {
    document.getElementById(TRAIN_PASSWORD_ID).classList.add('is-danger');
    console.error(
      `PASSWORD (${passwordWord}) NOT STARTING WITH '${PASSWORD}'!`
    );
  } else if (name.length === 0) {
    document.getElementById(TRAIN_NAME_ID).classList.add('is-danger');
    console.error(`NO NAME GIVEN! TODO!`);
  } else {
    // Otherwise the time delta
    for (let idx = 1; idx < PASSWORD.length; idx++) {
      passwordTimesteps.push(passwordTimes[idx] - passwordTimes[idx - 1]);
    }
    // Save the time delta
    if (name in data) {
      data[name].push(passwordTimesteps);
    } else {
      data[name] = [passwordTimesteps];
    }

    // Show some information
    document.getElementById(INFORMATION_ID).innerHTML = '';
    document.getElementById(INFORMATION_ID).classList.remove('is-hidden');
    for (const name in data) {
      let p = document.createElement('p');
      if (data[name].length >= MINIMUM_TYPED_PASSWORD) {
        p.innerHTML = `<p>${name} <span class="icon is-small"><i class="fa fa-check"></i></span></p>`;
      } else {
        p.innerHTML = `<p>${name} typed ${data[name].length} of ${MINIMUM_TYPED_PASSWORD} passwords.</p>\n`;
      }
      document.getElementById(INFORMATION_ID).append(p);
    }
  }
  // Reset the global password and clear the input
  passwordWord = '';
  passwordTimes = [];
  document.getElementById(TRAIN_PASSWORD_ID).value = '';

  // Enable/Disable the Train Button
  // At least two different user
  if (Object.keys(data).length > 1) {
    // Each has typed at least a few times
    let passed = true;
    for (const name in data) {
      if (data[name].length < MINIMUM_TYPED_PASSWORD) {
        passed = false;
        break;
      }
    }

    if (passed) {
      document.getElementById(TRAIN_BUTTON_ID).removeAttribute('disabled');
    }
  }
}

function inferPassword() {
  const passwordTimesteps = [];
  // Remove the red input if there was one
  document.getElementById(DETECT_PASSWORD_ID).classList.remove('is-danger');
  if (!passwordWord.startsWith(PASSWORD)) {
    document.getElementById(DETECT_PASSWORD_ID).classList.add('is-danger');
    console.error(
      `PASSWORD (${passwordWord}) NOT STARTING WITH '${PASSWORD}'!`
    );
  } else {
    // Compute the time delta
    for (let idx = 1; idx < PASSWORD.length; idx++) {
      passwordTimesteps.push(passwordTimes[idx] - passwordTimes[idx - 1]);
    }

    // Then detect it
    detectWithNeuralNetwork(passwordTimesteps);
  }
  // Reset the global password and the deltas
  passwordWord = '';
  passwordTimes = [];
  document.getElementById(DETECT_PASSWORD_ID).value = '';
}

function savePasswordTimesteps(e, infer) {
  // Save the timedelta between each keystroke
  if (e.key === 'Enter') {
    if (infer) {
      inferPassword();
    } else {
      savePassword();
    }
  } else if (e.key === 'Backspace') {
    if (passwordTimes.length > 0) {
      passwordWord = passwordWord.slice(0, -1);
      passwordTimes.pop();
    }
  } else if (e.key.length == 1) {
    passwordWord += e.key;
    passwordTimes.push(new Date().getTime());
  }
}

// ------------------
// Set up the UI
// ------------------

// Toggle the train/detect tabs
document.getElementById(SELECT_TRAIN_ID).addEventListener('click', (e) => {
  document.getElementById(SELECT_DETECT_ID).classList.remove('is-active');
  document.getElementById(SELECT_TRAIN_ID).classList.add('is-active');
  document.getElementById(CONTAINER_TRAIN_ID).style.display = 'block';
  document.getElementById(CONTAINER_DETECT_ID).style.display = 'none';
});
document.getElementById(SELECT_DETECT_ID).addEventListener('click', (e) => {
  document.getElementById(SELECT_TRAIN_ID).classList.remove('is-active');
  document.getElementById(SELECT_DETECT_ID).classList.add('is-active');
  document.getElementById(CONTAINER_DETECT_ID).style.display = 'block';
  document.getElementById(CONTAINER_TRAIN_ID).style.display = 'none';
});

// Save the password time if entered
document
  .getElementById(TRAIN_PASSWORD_ID)
  .addEventListener('keydown', (e) => savePasswordTimesteps(e, false));
document
  .getElementById(DETECT_PASSWORD_ID)
  .addEventListener('keydown', (e) => savePasswordTimesteps(e, true));

// Train on button click
document
  .getElementById(TRAIN_BUTTON_ID)
  .addEventListener('click', () => trainNeuralNetwork());

// Let the network take an educated guess
document
  .getElementById(DETECT_BUTTON_ID)
  .addEventListener('click', () => inferPassword());
