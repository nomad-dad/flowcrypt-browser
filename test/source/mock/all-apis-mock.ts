/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { Api, Handlers } from './lib/api';
import * as http from 'http';
import { mockBackendEndpoints } from './backend/backend-endpoints';
import { mockGoogleEndpoints } from './google/google-endpoints';
import { mockKeyManagerEndpoints } from './key-manager/key-manager-endpoints';
import { mockWkdEndpoints } from './wkd/wkd-endpoints';
import { mockSksEndpoints } from './sks/sks-endpoints';
import { mockCustomerUrlFesEndpoints } from './fes/customer-url-fes-endpoints';
import { mockSharedTenantFesEndpoints } from './fes/shared-tenant-fes-endpoints';

export type HandlersRequestDefinition = { query: { [k: string]: string }; body?: unknown };
export type HandlersDefinition = Handlers<HandlersRequestDefinition, unknown>;

export const startAllApisMock = async (logger: (line: string) => void) => {
  class LoggedApi<REQ, RES> extends Api<REQ, RES> {
    protected throttleChunkMsUpload = 15;
    protected throttleChunkMsDownload = 200;
    protected log = (ms: number, req: http.IncomingMessage, res: http.ServerResponse, errRes?: Buffer) => {
      if (req.url !== '/favicon.ico') {
        logger(`${ms}ms | ${res.statusCode} ${req.method} ${req.url} | ${errRes ? errRes : ''}`);
      }
    };
  }
  const api = new LoggedApi<HandlersRequestDefinition, unknown>('google-mock', {
    ...mockGoogleEndpoints,
    ...mockBackendEndpoints,
    ...mockKeyManagerEndpoints,
    ...mockWkdEndpoints,
    ...mockSksEndpoints,
    ...mockCustomerUrlFesEndpoints,
    ...mockSharedTenantFesEndpoints,
    '/favicon.ico': async () => '',
  });
  await api.listen();
  return api;
};
