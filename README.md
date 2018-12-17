A simple executor of code on python.

Each executor works in a separate docker container.

Example
```javascript
const Executor = require('python-executor');


Executor.prepare(error => {
  const executor = new Executor('python3') // ['python2', 'python3']

  executor.run('print("This code runed")', err => {
    executor.onData(data => console.log(data)) // when stdout 
    executor.onDone(data => console.log(data)) // when code done
    executor.onError(data => console.log(data)) // when error
});
```