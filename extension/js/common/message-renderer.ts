/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

'use strict';

import { GmailParser, GmailRes } from './api/email-provider/gmail/gmail-parser.js';
import { Attachment } from './core/attachment.js';
import { Buf } from './core/buf.js';
import { Dict, Str } from './core/common.js';
import { Mime, MimeContent, MimeProccesedMsg } from './core/mime.js';
import { MsgBlock } from './core/msg-block.js';
import { SendAsAlias } from './platform/store/acct-store.js';
import { Xss } from './platform/xss.js';
import { XssSafeFactory } from './xss-safe-factory.js';

export type ProccesedMsg = MimeProccesedMsg & {
  from?: string;
};

export type AttachmentBlock = {
  block: MsgBlock;
  file: Attachment; // todo: only need id in MsgBlock's AttachmentMeta?
};

export class MessageRenderer {
  public static renderMsg = (
    { from, blocks }: { blocks: { block: MsgBlock; file?: Attachment }[]; from?: string },
    factory: XssSafeFactory,
    showOriginal: boolean,
    msgId: string, // todo: will be removed
    sendAs?: Dict<SendAsAlias>
  ) => {
    const isOutgoing = Boolean(from && !!sendAs?.[from]);
    let r = '';
    const attachmentBlocks: AttachmentBlock[] = [];
    for (const block of blocks) {
      if (r) {
        r += '<br><br>';
      }
      if (['encryptedAttachment', 'plainAttachment'].includes(block.block.type) && !block.file) {
        // debugger;
        throw new Error('Unexpected!');
      }
      if (block.file && ['encryptedAttachment', 'plainAttachment'].includes(block.block.type)) {
        attachmentBlocks.push({ block: block.block, file: block.file });
      } else if (showOriginal) {
        r += Xss.escape(Str.with(block.block.content)).replace(/\n/g, '<br>');
      } else {
        r += XssSafeFactory.renderableMsgBlock(factory, block.block, msgId, from || 'unknown', isOutgoing);
      }
    }
    return { renderedXssSafe: r, attachmentBlocks, isOutgoing };
  };

  public static process = async (gmailMsg: GmailRes.GmailMsg): Promise<ProccesedMsg> => {
    const processedMsg = gmailMsg.raw ? await MessageRenderer.processMessageFromRaw(gmailMsg.raw) : MessageRenderer.processMessageFromFull(gmailMsg);
    return { from: GmailParser.findHeader(gmailMsg, 'from'), ...processedMsg };
  };

  public static processMessageFromRaw = async (raw: string) => {
    const mimeMsg = Buf.fromBase64UrlStr(raw);
    return await Mime.process(mimeMsg);
  };

  private static processMessageFromFull = (gmailMsg: GmailRes.GmailMsg) => {
    const bodies = GmailParser.findBodies(gmailMsg);
    const attachments = GmailParser.findAttachments(gmailMsg);
    const text = bodies['text/plain'] ? Buf.fromBase64UrlStr(bodies['text/plain']).toUtfStr() : undefined;
    // todo: do we need to strip?
    const html = bodies['text/html'] ? Xss.htmlSanitizeAndStripAllTags(Buf.fromBase64UrlStr(bodies['text/html']).toUtfStr(), '\n') : undefined;
    // reconstructed MIME content
    const mimeContent: MimeContent = {
      text,
      html,
      attachments,
    };
    return Mime.processDecoded(mimeContent);
  };
}
