import { Body, Controller, Param, Post } from '@nestjs/common';
import { invalidInput, parseInput, slugSchema } from '../common/validation.js';
import { ScenariosService } from './scenarios.service.js';

@Controller('projects/:project/scenarios')
export class ScenariosController {
  constructor(private readonly scenarios: ScenariosService) {}

  @Post()
  saveScenario(@Param('project') project: string, @Body() body: unknown) {
    if (typeof body !== 'string' || body.trim() === '') {
      throw invalidInput([
        {
          path: '',
          message:
            'Send the scenario as YAML with the header Content-Type: text/yaml',
        },
      ]);
    }

    return this.scenarios.saveScenario(parseInput(slugSchema, project), body);
  }
}
