import { test } from 'tap';
import TaskRunner from '../src/services/taskrunner/TaskRunner';

test('TaskRunner', (t) => {
  t.test('contains - checks if task exists', (subt) => {
    const runner = new TaskRunner();
    subt.notOk(runner.contains('nonexistent'), 'should return false for non-existent task');
    subt.end();
  });

  t.test('constructor - initializes empty tasks array', (subt) => {
    const runner = new TaskRunner();
    subt.ok(Array.isArray(runner.tasks), 'tasks should be an array');
    subt.equal(runner.tasks.length, 0, 'tasks array should be empty initially');
    subt.end();
  });

  t.test('inheritance - extends EventEmitter', (subt) => {
    const runner = new TaskRunner();
    subt.ok(typeof runner.on === 'function', 'should have EventEmitter methods');
    subt.ok(typeof runner.emit === 'function', 'should have EventEmitter methods');
    subt.end();
  });

  t.end();
});
