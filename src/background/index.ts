import { registerAuthHandler } from './auth';
import { registerErrorHandler } from './errors';
import { registerMessageRouter } from './message-router';
import { registerProxyController } from './proxy-controller';

console.info('Smart Proxy background service worker initialized');
registerProxyController();
registerAuthHandler();
registerErrorHandler();
registerMessageRouter();
