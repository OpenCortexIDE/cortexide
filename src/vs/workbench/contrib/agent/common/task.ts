export interface ITask {
  readonly taskId: string;
  readonly rootTaskId?: string;
  readonly parentTaskId?: string;
  childTaskId?: string;
}
