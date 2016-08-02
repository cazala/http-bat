
import {ATL, IATLOptions} from './../dist/lib/ATL';
import { Runnable } from './../dist/lib/Runnable';

declare var describe, it;


describe('Basic runs', () => {
  it('Promises must be handled by mocha', () => Promise.resolve(1));

  it('Must pass without dependencies', () => {
    let r0 = new Runnable(() => {
      return Promise.resolve(1);
    });

    r0.run();

    return r0;
  });


  let val = 0;
  let r0 = new Runnable(() => {
    val++;
    return Promise.resolve(1);
  });

  it('It must not run till .run()', () => {
    if (val != 0) throw new Error(val.toString());
  });

  it('Must pass with dependencies', () => {
    let r1 = new Runnable(() => {
      if (val == 0)
        return Promise.reject<number>(1);
      return Promise.resolve(1);
    });

    r1.addDependency(r0);

    r1.run();

    return r1;
  });

  it('Must pass with dependencies already runned', () => {
    let r1 = new Runnable(() => {
      if (val != 1)
        return Promise.reject<number>(val);
      return Promise.resolve(1);
    });

    r1.addDependency(r0);

    r1.run();

    return r1;
  });


  it('should fail on cascade', (done) => {
    let val = 0;

    let r0 = new Runnable(() => {
      val++;
      return Promise.resolve(1);
    });

    let r1 = new Runnable(() => {
      val++;
      return Promise.reject(1);
    });

    r1.addDependency(r0);

    let r2 = new Runnable(() => {
      val++;
      return Promise.resolve(1);
    });

    r2.addDependency(r1);

    r2.run();

    r2.catch(x => {
      if (val != 2) done(new Error(val.toString()));
      done();
    });

    r2.then(x => {
      done(new Error("it should have failed " + x));
    });
  });

});