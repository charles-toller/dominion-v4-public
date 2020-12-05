dominion-v4
=====
### Directory Meanings

You can find definitions for each card in the game located under the `src/cards` directory, and most of the game logic
is located in `src/cards/{Game,Player}.ts`.

There are tests for every card and many of the subsystems in the `test` directory. Run `npm test` to run them.

There are tests for the client in the `testClient` directory. Ensure you have Google Chrome and [chromedriver](https://chromedriver.chromium.org/) installed, then run `npm run test-client` to run them.

### Installation
To build, you'll need to have Node.js v14 or later installed.

Then, run `npm run buildServer && npm run buildClient` to build the application.

Finally, run `PORT=3000 npm run main` to start the server. Note that in the public version of this repository,
many assets have been removed for copyright reasons, and will need replacements.