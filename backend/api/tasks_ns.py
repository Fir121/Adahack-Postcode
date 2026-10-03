from attr import asdict
from flask_restx import Namespace, Resource, fields
from backend.models.task import Task, TaskModel

tasks_ns = Namespace("tasks", description="Operations related to tasks")

task_model = tasks_ns.model(
    "Task",
    {
        "task_id": fields.String(required=True, description="Task ID"),
        "name": fields.String(required=True, description="Task name"),
        "description": fields.String(required=True, description="Task description"),
        "points": fields.Integer(required=True, description="Task points"),
    },
)


@tasks_ns.route("")
class TaskListResource(Resource):
    @tasks_ns.marshal_list_with(task_model)
    def get(self):
        """Get list of tasks"""
        return TaskModel.list(), 200


@tasks_ns.route("/<string:task_id>")
@tasks_ns.param("task_id", "The task identifier")
class TaskResource(Resource):
    @tasks_ns.marshal_with(task_model)
    def get(self, task_id):
        """Get a single task"""
        task = TaskModel.read(task_id)
        if not task:
            tasks_ns.abort(404, "Task not found")
        return asdict(task), 200
