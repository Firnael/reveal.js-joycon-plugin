/** This file is for testing the plugin using Vite */
import Plugin from './src/plugin';

/**
 * Mock the Reveal API to test inputs (may need more later on)
 */
const RevealMock = {
    left: () => console.log('left'),
    right: () => console.log('right'),
    up: () => console.log('up'),
    down: () => console.log('down'),
    next: () => console.log('next'),
    prev: () => console.log('prev'),
    isOverview: () => console.log('isOverview'),
    toggleOverview: () => console.log('toggleOverview'),
    togglePause: () => console.log('togglePause'),
    toggleHelp: () => console.log('toggleHelp'),
    getConfig: () => {
        return {
            joycon: {
                type: 'right',
                cooldown: 200,
                pointerSpeed: 25
            }
        };
    }
};

const plugin = Plugin();
plugin.init(RevealMock);
