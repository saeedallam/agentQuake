import { quake } from '../index.js';

const getWeather = async (city: string) => ({ city, temp: 30 });

it('matches the silent faults example in the package README', async () => {
  const run = quake({
    faults: [
      { id: 'empty', type: 'empty_response', target: { tool: 'getWeather' } },
    ],
  });

  const answer = await run.agent(async () => {
    const weather = await run.tool('getWeather', getWeather)('Cairo');
    return `It is ${weather.temp} degrees`;
  });

  expect(answer).toBe('It is undefined degrees');
  expect(run.report().leakedGarbage).toBe(true);
});
