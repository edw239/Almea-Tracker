import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TaskAccessService } from './access/task-access.service';
import { TaskSpaceAccessService } from './access/task-space-access.service';
import { TaskListResolverService } from './host/task-list-resolver.service';
import { HostEntitiesController } from './host-entities.controller';
import { TaskCollabService } from './services/task-collab.service';
import { ColleagueService } from './services/colleague.service';
import { HostEntitiesService } from './services/host-entities.service';
import { TaskHostService } from './services/task-host.service';
import { TaskListStatusesService } from './services/task-list-statuses.service';
import { TaskNotificationsService } from './services/task-notifications.service';
import { TaskSpacesService } from './services/task-spaces.service';
import { TaskTemplatesService } from './services/task-templates.service';
import { TaskSchedulesService } from './services/task-schedules.service';
import { TasksService } from './services/tasks.service';
import { TaskIdentityService } from './services/task-identity.service';
import { TaskStatusService } from './services/task-status.service';
import { TaskViewsService } from './services/task-views.service';
import { WorkSchedulerService } from './services/work-scheduler.service';
import { ColleagueController } from './colleague.controller';
import { TaskCollabController } from './task-collab.controller';
import { TaskHostController } from './task-host.controller';
import { TaskNotificationsController } from './task-notifications.controller';
import { TaskSpacesController } from './task-spaces.controller';
import { TaskTemplatesController } from './task-templates.controller';
import { TaskSchedulesController } from './task-schedules.controller';
import { TaskListStatusesController } from './task-list-statuses.controller';
import { TaskTypeItemController, TaskTypesController } from './task-types.controller';
import { BoardsController, LabelsController } from './boards/boards.controller';
import { BoardAccessService } from './boards/board-access.service';
import { BoardsService } from './boards/boards.service';
import { SprintsService } from './boards/sprints.service';
import { BoardReportsService } from './boards/board-reports.service';
import { LabelsService } from './services/labels.service';
import { TaskListStatusesAdminService } from './services/task-list-statuses-admin.service';
import { TaskTypesService } from './services/task-types.service';
import { TasksController } from './tasks.controller';
import { TaskViewsController } from './task-views.controller';
import { OverviewController } from './overview.controller';
import { OverviewService } from './services/overview.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    TaskSpacesController,
    TasksController,
    TaskCollabController,
    TaskViewsController,
    TaskNotificationsController,
    TaskHostController,
    TaskTemplatesController,
    TaskSchedulesController,
    TaskListStatusesController,
    TaskTypesController,
    TaskTypeItemController,
    BoardsController,
    LabelsController,
    ColleagueController,
    HostEntitiesController,
    OverviewController,
  ],
  providers: [
    TaskSpaceAccessService,
    TaskAccessService,
    TaskListStatusesService,
    TaskListResolverService,
    TaskSpacesService,
    TaskNotificationsService,
    TaskCollabService,
    TaskIdentityService,
    TaskStatusService,
    TasksService,
    TaskViewsService,
    TaskHostService,
    TaskTemplatesService,
    TaskSchedulesService,
    TaskListStatusesAdminService,
    TaskTypesService,
    LabelsService,
    BoardAccessService,
    SprintsService,
    BoardsService,
    BoardReportsService,
    WorkSchedulerService,
    ColleagueService,
    HostEntitiesService,
    OverviewService,
  ],
  exports: [TaskListResolverService, TaskHostService, HostEntitiesService],
})
export class WorkManagementModule {}
