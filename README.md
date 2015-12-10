# stressMQTT
MQTT test suite for Mosquitto, Mosca, Aedes to generate timing numbers for key operations under load. 

Example timings from runs with Mosquitto, Mosca, Aedes are provided in the logs directory.

On my machine as an example, I have to run mocha with the option "--timeout 32000" so it waits long enough for Mosquitto's Echo behaviour to complete.
