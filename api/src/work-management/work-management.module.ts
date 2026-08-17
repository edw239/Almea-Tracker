import { Module } from '@nestjs/common';
import { TaskAccessService } from './access/task-access.service';
import { TaskSpaceAccessService } from './access/task-space-access.service';
import { TaskListResolverService } from './host/task-list-resolver.service';
import { TaskCollabService } from './services/task-collab.service';
import { TaskHostService } from './services/task-host.service';
import { TaskListStatusesService } from './services/task-list-statuses.service';
import { TaskNotificationsService } from './services/task-notifications.service';
import { TaskSpacesService } from './services/task-spaces.service';
import { TaskTemplatesService } from './services/task-templates.service';
import { TasksService } from './services/tasks.service';
import { TaskViewsService } from './services/task-views.service';
import { TaskCollabController } from './task-collab.controller';
import { TaskHostController } from './task-host.controller';
import { TaskNotificationsController } from './task-notifications.controller';
import { TaskSpacesController } from './task-spaces.controller';
import { TaskTemplatesController } from './task-templates.controller';
import { TasksController } from './tasks.controller';
import { TaskViewsController } from './task-views.controller';

@Module({
  controllers: [
    TaskSpacesController,
    TasksController,
    TaskCollabController,
    TaskViewsController,
    TaskNotificationsController,
    TaskHostController,
    TaskTemplatesController,
  ],
  providers: [
    TaskSpaceAccessService,
    TaskAccessService,
    TaskListStatusesService,
    TaskListResolverService,
    TaskSpacesService,
    TaskNotificationsService,
    TaskCollabService,
    TasksService,
    TaskViewsService,
    TaskHostService,
    TaskTemplatesService,
  ],
  exports: [TaskListResolverService, TaskHostService],
})
export class WorkManagementModule {}
