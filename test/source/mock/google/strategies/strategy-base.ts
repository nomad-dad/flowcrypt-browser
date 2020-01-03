/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import { ParsedMail } from 'mailparser';

export interface ITestMsgStrategy {
    test(mimeMsg: ParsedMail): Promise<void>;
}

export class UnsuportableStrategyError extends Error { }
