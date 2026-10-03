from attr import asdict
from flask_restx import Namespace, Resource, fields
from backend.models.task import Task

tasks_ns = Namespace("tasks", description="Operations related to tasks")

# Hardcoded list of tasks as Task dataclasses
tasks = [
    Task(task_id="1", name="Short Hop", description="Walk or cycle one journey you would normally drive"),
    Task(task_id="2", name="Charity Drop",
         description="Donate a bag of goods to a local charity shop and scan the QR code"),
    Task(task_id="3", name="Car-Free Day", description="Make every trip for one day on foot, by bike or by bus"),
    Task(task_id="4", name="Plant a Pot",
         description="Plant a window box, pot or shared planter (suits streets with no gardens)"),
    Task(task_id="5", name="Litter Pick", description="Spend 15 minutes clearing litter on your street"),
    Task(task_id="6", name="Helping Hand", description="Do an outdoor chore for a neighbour, such as mowing a lawn"),
    Task(task_id="7", name="Borrow, Don't Buy", description="Borrow an item from a neighbour instead of buying it new"),
    Task(task_id="8", name="Second-Hand Find", description="Buy one thing second-hand this week"),
]

# API models for Swagger documentation
task_model = tasks_ns.model(
    "Task",
    {
        "task_id": fields.String(required=True, description="Task ID"),
        "name": fields.String(required=True, description="Task name"),
        "description": fields.String(required=True, description="Task description"),
        "points": fields.Integer(required=True, description="Task points"),
    },
)


# Routes
@tasks_ns.route("")
class TaskListResource(Resource):
    @tasks_ns.marshal_list_with(task_model)
    def get(self):
        """Get list of tasks"""
        return [asdict(task) for task in tasks], 200


@tasks_ns.route("/<string:task_id>")
@tasks_ns.param("task_id", "The task identifier")
class TaskResource(Resource):
    @tasks_ns.marshal_with(task_model)
    def get(self, task_id):
        """Get a single task"""
        task = next((task for task in tasks if task.task_id == task_id), None)
        if not task:
            tasks_ns.abort(404, "Task not found")
        return asdict(task), 200
