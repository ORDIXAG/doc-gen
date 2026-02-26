import { defineConfig } from 'cypress'

const registerCodeCoverageTasks = require('@cypress/code-coverage/task');

export default defineConfig({
  videosFolder: 'cypress/videos',
  screenshotsFolder: 'cypress/screenshots',
  fixturesFolder: 'cypress/fixtures',
  video: false,
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      return registerCodeCoverageTasks(on, config)
    },
    baseUrl: 'http://localhost:4200/dokumentationsgenerator_local',
  },
})