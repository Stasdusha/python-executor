const { EOL } = require('os');
const { DOCKER_IMAGES } = require('./config');
const Docker = require('dockerode');
const setOption = Symbol('setOption');
const pullAllImages = Symbol('pullAllImages');
const docker = new Docker();


class Executor {

  /**
   * Code executor.
   * @param {String} language 
   * @param {String} code 
   */
  constructor(language) {
    this.language = language;
    this.stderror = '';
    this.stream = null;
    this.container = null;
  }

  static async prepare(cb) {
    Executor[pullAllImages](DOCKER_IMAGES, cb)
  }

  static async [pullAllImages](images = [], cb) {
    try {
      console.log(images)
      if (!images.length) return cb();
      const image = images.shift();

      const imgs = await docker.listImages();
      const _img = imgs.find(img => img.RepoTags.includes(image));

      if (_img) return Executor[pullAllImages](images, cb);

      console.log(`${image} pulling`);

      docker.pull(image, (err, stream) => {
        if (err) return cb(err);

        docker.modem.followProgress(stream, (err, data) => {
          if (err) {
            console.error(`${image} did not pull`);
            console.error(err);
            return
          }
          console.log(`${image} image pulled`);
          Executor[pullAllImages](images, cb);
        });
      })
    } catch (e) {
      console.error('Executor did not pripare error:' + e)
    }
  }

  [setOption]() {
    const options = {
      Tty: true,
      AttachStdout: true,
      AttachStderr: true,
      Env: ['PYTHONUNBUFFERED=1']
    };
    switch (this.language) {
      case 'python3':
        return { ...options, Image: 'python:3-slim' };
      case 'python2':
      default:
        return { ...options, Image: 'python:2.7-slim' };
    }
  }

  /**
   * Run container
   * @param {String} code 
   * @param {Function} cb 
   */
  run(code, cb) {
    const options = this[setOption]();

    docker.createContainer(options, async (err, container) => {
      if (err) return cb(err);

      await container.start();

      container.wait((err, data) => {
        this.stream.end();
        this.container.remove();
      });

      this.container = container;

      container.exec({
        Cmd: ['python', '-c', code],
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false
      }, (err, exec) => {
        exec.start({ hijack: true, stdin: true, stdout: true, stderr: true }, (err, stream) => {
          this.stream = stream;
          cb();
        });
      });
    });
  }

  /**
   * Kill container
   * @returns {void}
   */
  kill() { this.container.kill(); }

  /**
   * Write to stdin
   * @param {String} str 
   */
  writeSTDIN(str) {
    this.stream.write(str + EOL);
  }

  /**
   * on data callback
   * @param {Function<String>} cb 
   */
  onData(cb) {
    if (!(cb instanceof Function)) throw Error('callback is not a function');
    this.stream.on('data', chunk => {
      /**
       * Removing first 8 bytes. 
       */
      const str = chunk
        .slice(-(chunk.length - 8))
        .toString('utf-8');
      cb(str);
    });
  }

  /**
   * onClose callback
   * @param {Function<void>} cb 
   */
  onDone(cb) {
    if (!(cb instanceof Function)) throw Error('callback is not a function');
    this.stream.on('end', () => this.container.kill(() => cb()));
  }

  /**
   * onClose with error
   * @param {Function<String>} cb 
   */
  onError(cb) {
    if (!(cb instanceof Function)) throw Error('callback is not a function');
    this.stream.on('end', () => this.stderror && cb(this.stderror));
  }

}

module.exports = Executor;
