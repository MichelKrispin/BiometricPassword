# Biometric Password Detection

Everybody types in their passwords differently, leaving different amounts of time between their keystrokes. This makes it possible to detect who typed in a password, just by measuring the time between each keystroke and using some deep learning magic, i.e. [TensorFlow JS](https://www.tensorflow.org/js). Keeping it simple, here the password is password and one should type it in a couple of times, then let someone else type it in and see if the neural network's educated guess is correct.

Note, that everything is saved in the browser so that all data is lost when this page is refreshed or closed.
