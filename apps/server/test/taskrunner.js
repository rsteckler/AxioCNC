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

  t.test('run - parameter handling variations', (subt) => {
    const runner = new TaskRunner();

    // Test normal case: command, title, options
    const id1 = runner.run('ls', 'List files', { cwd: '/tmp' });
    subt.ok(typeof id1 === 'string' && id1.length > 0, 'should return task id for normal case');

    // Test overload: command, options (title omitted)
    const id2 = runner.run('pwd', { cwd: '/tmp' });
    subt.ok(typeof id2 === 'string' && id2.length > 0, 'should return task id for overload case');

    // Test with undefined options
    const id3 = runner.run('echo hello', 'Echo command');
    subt.ok(typeof id3 === 'string' && id3.length > 0, 'should return task id with undefined options');

    subt.end();
  });

  t.test('run - adds multiple tasks', (subt) => {
    const runner = new TaskRunner();

    const id1 = runner.run('cmd1', 'Task 1');
    const id2 = runner.run('cmd2', 'Task 2');
    const id3 = runner.run('cmd3', 'Task 3');

    subt.equal(runner.tasks.length, 3, 'should have 3 tasks');
    subt.ok(runner.contains(id1), 'should contain first task');
    subt.ok(runner.contains(id2), 'should contain second task');
    subt.ok(runner.contains(id3), 'should contain third task');

    subt.end();
  });

  t.end();
});
