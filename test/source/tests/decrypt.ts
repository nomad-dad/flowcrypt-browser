/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */

import test from 'ava';

import { Config, TestVariant, Util } from './../util';
import { testConstants } from './tooling/consts';
import { BrowserRecipe } from './tooling/browser-recipe';
import { GoogleData } from '../mock/google/google-data';
import { InboxPageRecipe } from './page-recipe/inbox-page-recipe';
import { SettingsPageRecipe } from './page-recipe/settings-page-recipe';
import { TestWithBrowser } from './../test';
import { expect } from 'chai';
import { PageRecipe } from './page-recipe/abstract-page-recipe';
import {
  get203FAE7076005381,
  protonMailCompatKey,
  mpVerificationKey,
  sha1signpubkey,
  somePubkey,
  singlePubKeyAttesterConfig,
} from '../mock/attester/attester-key-constants';
import { ConfigurationProvider, HttpClientErr, Status } from '../mock/lib/api';

export const defineDecryptTests = (testVariant: TestVariant, testWithBrowser: TestWithBrowser) => {
  if (testVariant !== 'CONSUMER-LIVE-GMAIL') {
    test(
      `decrypt - detect bogus pgp message`,
      testWithBrowser(async (t, browser) => {
        const threadId = '17d7a32a0613071d';
        const msgId = '17d7a337b7b87eb9';
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitForSelTestState('ready');
        await inboxPage.waitAll('iframe');
        const plainMessage = /-----BEGIN PGP MESSAGE-----.*This is not a valid PGP message/s;
        await inboxPage.waitForContent('@message-line', plainMessage);
        // expect no pgp blocks
        expect((await inboxPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(0);
        await inboxPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${msgId}`, undefined, authHdr);
        await gmailPage.waitForContent('.a3s', plainMessage);
        expect((await gmailPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(0);
        await gmailPage.close();
      })
    );

    test(
      `decrypt - detect inline bogus pgp message`,
      testWithBrowser(async (t, browser) => {
        const threadId = '17fbb5db49ddc1eb';
        const msgId = '17fbb5f1cd2010ee';
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitForSelTestState('ready');
        await inboxPage.waitAll('iframe');
        const plainMessage = /An OpenPGP message starts with this header:\r?\n-----BEGIN PGP MESSAGE-----\r?\n\r?\nexample/s;
        await inboxPage.waitForContent('@message-line', plainMessage);
        // expect no pgp blocks
        expect((await inboxPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(0);
        await inboxPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${msgId}`, undefined, authHdr);
        await gmailPage.waitForContent('.a3s', plainMessage);
        expect((await gmailPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(0);
        await gmailPage.close();
      })
    );

    test(
      `decrypt - show remote images`,
      testWithBrowser(async (t, browser) => {
        const threadId = '186bd029856d1e39';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitForSelTestState('ready');
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForContent('@remote-image-container', 'Authenticity of this remote image cannot be verified.');
        await pgpBlock.checkIfImageIsDisplayedCorrectly('#pgp_block img');
        // Chceck if forwarded message contains img url
        await inboxPage.waitAll('iframe');
        // Get Reply Window (Composer) and click on reply button.
        const replyFrame = await inboxPage.getFrame(['compose.htm']);
        await replyFrame.waitAndClick('@action-forward');
        await replyFrame.waitForContent('@input-body', 'https://flowcrypt.com/assets/imgs/svgs/flowcrypt-logo.svg');
        await inboxPage.close();
      })
    );

    test(
      `decrypt - show inline image when user clicks show image`,
      testWithBrowser(async (t, browser) => {
        const threadId = '1850f9608240f758';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitForSelTestState('ready');
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForContent('@pgp-block-content', 'This message contains inline base64 image');
        await pgpBlock.waitAll('#pgp_block img');
        await pgpBlock.checkIfImageIsDisplayedCorrectly('#pgp_block img');
        await inboxPage.close();
      })
    );

    test(
      `decrypt - parsed signed message with signature.asc as plain attachment`,
      testWithBrowser(async (t, browser) => {
        const threadId = '187085b874fb727c';
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const expectedContent = 'flowcrypt-browser issue #5029 test email';
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitForSelTestState('ready');
        await inboxPage.waitAll('iframe');
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame(['pgp_block.htm']), {
          encryption: 'not encrypted',
          content: [expectedContent],
        });
        await inboxPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${threadId}`, undefined, authHdr);
        await gmailPage.waitAll('iframe');
        await BrowserRecipe.pgpBlockCheck(t, await gmailPage.getFrame(['pgp_block.htm']), {
          encryption: 'not encrypted',
          content: [expectedContent],
        });
        await gmailPage.close();
      })
    );

    test(
      `decrypt - parsed encrypted message signed with signature.asc inline attachment`,
      testWithBrowser(async (t, browser) => {
        const threadId = '187ebe3cd1fae41e';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitForSelTestState('ready');
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await BrowserRecipe.pgpBlockCheck(t, pgpBlock, {
          encryption: 'encrypted',
          signature: 'signed',
          content: ['Check signature'],
        });
        expect(await inboxPage.isElementPresent('@container-attachments')).to.equal(false);
        await inboxPage.close();
        // todo: test mock gmail
      })
    );

    test(
      `decrypt - outlook message with ATTxxxx encrypted email doesn't show empty attachment`,
      testWithBrowser(async (t, browser) => {
        const threadId = '17dbdf2425ac0f29';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitForSelTestState('ready');
        await inboxPage.waitAll('iframe');
        expect(await inboxPage.isElementPresent('@container-attachments')).to.equal(false);
        await inboxPage.close();
      })
    );

    test(
      'decrypt - encrypted text inside "message" attachment is correctly decrypted',
      testWithBrowser(async (t, browser) => {
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        /* eslint-disable @typescript-eslint/no-non-null-assertion */
        const key = Config.key('flowcrypt.compatibility.1pp1')!;
        await SettingsPageRecipe.addKeyTest(t, browser, acctEmail, key.armored!, key.passphrase, {}, false);
        /* eslint-enable @typescript-eslint/no-non-null-assertion */
        await InboxPageRecipe.checkDecryptMsg(t, browser, {
          acctEmail,
          threadId: '184a474fc1bd59b8',
          expectedContent: 'This message contained the actual encrypted text inside a "message" attachment.',
        });
      })
    );

    test(
      `decrypt - render plain text for "message" attachment (which has plain text)`,
      testWithBrowser(async (t, browser) => {
        const threadId = '184a87a7b32dd009';
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitForSelTestState('ready');
        await inboxPage.waitAll('iframe');
        expect(await inboxPage.isElementPresent('@container-attachments')).to.equal(true);
        await inboxPage.waitForContent('@message-line', 'Plain message');
        // expect no pgp blocks
        const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm']);
        expect(urls.length).to.equal(0);
        await inboxPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${threadId}`, undefined, authHdr);
        await gmailPage.waitForContent('.a3s', 'Plain message');
        expect((await gmailPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(0);
        await gmailPage.close();
      })
    );

    test(
      `decrypt - outlook message with ATTxxxx encrypted email is correctly decrypted`,
      testWithBrowser(async (t, browser) => {
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await InboxPageRecipe.checkDecryptMsg(t, browser, {
          acctEmail,
          threadId: '17dbdf2425ac0f29',
          expectedContent: 'Documento anexo de prueba.docx',
        });
      })
    );

    test(
      'mail.google.com - decrypt message in offline mode',
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        t.mockApi!.configProvider!.config.google = {
          getMsg: {
            '17b91b7e122902d2': { error: new HttpClientErr('RequestTimeout', Status.BAD_REQUEST) },
          },
        };
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '17b91b7e122902d2',
          {
            content: ['this should decrypt even offline'],
            encryption: 'encrypted',
            signature: 'signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - without a subject`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1600f39127880eed',
          {
            content: ['This is a compatibility test email'],
            unexpectedContent: ['Encrypted Subject:', '(no subject)'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] encrypted iso-2022-jp pgp/mime`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16f66f1da9d50d05',
          {
            content: ['ゾし逸現飲'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] encrypted iso-2022-jp, plain text`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16f431a0b9056562',
          {
            content: ['ゾし逸現飲'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - iso-2022-jp, signed plain text`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '18024d53a24b19ff',
          {
            content: ['テストです\nテスト'],
            encryption: 'not encrypted',
            signature: 'could not verify signature: missing pubkey 73A5534E5887BBAA',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - quoted part parsing will not crash browser`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16b7fce1c1589c0a',
          {
            content: ['point to them directly', 'free cert through', 'will honestly soon', 'dropped significantly'],
            encryption: 'encrypted',
            signature: 'not signed',
            quoted: true,
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [flowcrypt] signed message inline`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f7f5e966792203',
          {
            content: ['Standard message', 'signed inline', 'should easily verify', 'This is email footer'],
            encryption: 'not encrypted',
            signature: 'could not verify signature: missing pubkey 06CA553EC2455D70',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - cleartext signed message detected in an attachment`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1885ded59a2b5a8d',
          {
            content: ['Standard message', 'signed inline', 'should easily verify', 'This is email footer'],
            encryption: 'not encrypted',
            signature: 'could not verify signature: missing pubkey 06CA553EC2455D70',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [gpgmail] signed message will get parsed and rendered (though verification fails, enigmail does the same)`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f81b5e6ed91b20',
          {
            content: ['Hi this is a signed message.'],
            encryption: 'not encrypted',
            signature: 'could not verify signature: missing pubkey 21FC55064B1DDC75',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [gpg] signed fully armored message`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1707b9c96c5d7893',
          {
            content: ['this was encrypted with gpg', 'gpg --sign --armor -r flowcrypt.compatibility@gmail.com ./text.txt'],
            encryption: 'not encrypted',
            signature: 'could not verify signature: missing pubkey 7FDE685548AEA788',
            quoted: false,
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [flowcrypt] encrypted utf8`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f7f5f098d6bc36',
          {
            content: ['გამარჯობა.', 'こんにちは。', 'Здравствуй.', 'Chào bạn.', 'Dobrý deň!', '여보세요?', '你好。'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [flowcrypt] encrypted thai utf8`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1645e37647db32f8',
          {
            content: ['ทดสอบ', 'นี้เป็นการทดสอบ', 'ภาษาไทย'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [facebook] encrypted utf8`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16180866d0ae26c3',
          {
            content: ['Сергій Ткаченко'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey 6859679E2F20BEF4',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [gpgmail] encrypted utf8`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '161b2ac5a73d4097',
          {
            content: ['Prozent => %', 'Scharf-S => ß', 'Ue => Ü', 'Ae => Ä'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey 9BBE40BC1E8CE4A3',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] encrypted utf8`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1639b8ceb6c44a4c',
          {
            content: ['TEST, ПРОВЕРКА', 'C увaжeниeм, Пaвлoвcкий Poмaн Oлeгoвич.'],
            encryption: 'encrypted',
            signature: 'not signed',
            quoted: true,
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] encrypted pgp/mime`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f7fcace2d72246',
          {
            content: ['This is an encrypted message.', 'Not much going on here.'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] encrypted inline`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f7fcb7fabc7511',
          {
            content: ['This is inline-encrypted message from Enigmail.', 'Yay.'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] encrypted+signed inline`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f7fd2fd072cff2',
          {
            content: ['This message is both encrypted + signed.'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey CBD1C3466E9C437F',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] encrypted+signed pgp/mime`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f7fd3ba3f37cf3',
          {
            content: ['Message encrypted and signed using PGP/MIME.'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey CBD1C3466E9C437F',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] encrypted+signed+file pgp/mime + load from gmail`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f7fd7fe45fc026',
          {
            content: ['Message encrypted and signed as a whole using PGP/MIME.', 'cape-town-central.jpg', '185.69 kB'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey CBD1C3466E9C437F',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - encrypted missing checksum`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '15f7ffbebc6ba296',
          {
            content: ['400 library systems in 177 countries worldwide'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - pgp/mime with large attachment - mismatch`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '162275c819bcbf9b',
          {
            content: ['Your current key cannot open this message.'],
            error: 'decrypt error',
            expectPercentageProgress: true,
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - pgp/mime with large attachment`,
      testWithBrowser(async (t, browser) => {
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const msgId = '1622ea42f3654ddc';
        const expectedMessage = {
          content: ['This will will have a larger attachment below', 'image-large.jpg'],
          encryption: 'encrypted',
          signature: 'not signed',
          expectPercentageProgress: true,
        };
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${msgId}`);
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame(['pgp_block.htm']), expectedMessage);
        await inboxPage.close();
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(t, browser, msgId, expectedMessage, authHdr);
      })
    );

    test(
      `decrypt - pgp/mime with large attachment as message.asc`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1622eaa286f90737',
          {
            content: ['This will will have a larger attachment below', 'image-large.jpg'],
            encryption: 'encrypted',
            signature: 'not signed',
            expectPercentageProgress: true,
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - pgp/mime with small attachments as message.asc`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16224f57d26e038e',
          {
            content: ['Can you confirm this works.', 'Senior Consultant, Security'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey 6FC39F2CDD104B3C',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [flowcrypt] escape and keep tags in plain text`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1663ac8b70e22517',
          {
            content: ['thispasswordhasa<tag>init'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [symantec] base64 german umlauts`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '166117c082a73905',
          {
            content: ['verspätet die gewünschte', 'Grüße', 'ä, ü, ö or ß'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [gnupg v2] thai text`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '166147ea9bb6669d',
          {
            content: ['still can read your message ยังคงอ่านได้อยู่', "This is time I can't read ครั้งนี้อ่านไม่ได้แล้ว"],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [gnupg v2] thai text in html`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16613ff9c3735102',
          {
            content: ['เทสไทย', 'Vulnerability Assessment'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [enigmail] basic html`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1663a65bbd73ce1a',
          {
            content: ['The following text is bold: this is bold'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey D97859FF68EA0F04',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [thunderbird] unicode chinese`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '164563dc9e3a8549',
          {
            content: ['這封信是用 Thunderbird 做加密與簽章所寄出。', '第四屆董事會成員、認證委員會委員'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey 0B38948F4CD565B5',
            quoted: true,
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [security] mdc - missing - error`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '163df1bf12034b9d',
          {
            error: 'decrypt error',
            content: ['Security threat!', 'MDC', 'Display the message at your own risk.'],
            unexpectedContent: ['As stated in subject', 'Shall not decrypt automatically', 'Has to show a warning'],
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [security] mdc - modification detected - error`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '163dee87a4bfed45',
          {
            error: 'decrypt error',
            content: ['Security threat - opening this message is dangerous because it was modified in transit.'],
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [security] signed message - maliciously modified - should not pass`,
      testWithBrowser(async (t, browser) => {
        const { authHdr, acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const msgId = '15f7f7c5979b5a26';
        await PageRecipe.addPubkey(
          t,
          browser,
          acctEmail,
          `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: FlowCrypt Email Encryption 8.2.0
Comment: Seamlessly send and receive encrypted email

xsFNBFj/aG8BEADO625P5MArNIVlMBPp/HM1lYD1gcVwgYl4aHuXohDMS6dv
VAlSDXMVWwbsXJ9T3AxYIL3ZoOFDc1Jy0AqBKhYoOYm5miYHpOQtP/M4V6fK
3rhmc8C1LP1JXuaEXS0w7MQig8JZC08ECUH1/Gnhm3tyacRgrAr13s591Obj
oP/kwglOUjKDYvkXXk9iwouU85sh9HKwC4wR6idFhFSnsl8xp4FI4plLQPTy
Ea1nf3l+oVqCFT5moVtsew7qUD5mWkgytEdr728Sqh5vjiO+lc6cjqb0PK77
DAuhTel1bV5PRCtRom/qrqmOz4MbE5wd2kU/JxFPIXZ1BKyicT/Q6I9MXjni
77Bl91x0V9brnBqyhfY524Vlm/2AEb3H9I10rsTBtU4TT+SJOlwyU1V7hDkJ
Kq1zTrVjCvoPcTBXGx9xSZmJO4TI7frNZFiJ5uiYwTYPwp3Yze69y/NORwme
ZlXtXJbzpVvRzXUzex89c6pFiKE8mC5/DV/eJanBYKgSyGEiHq9U6kDJrTN4
/fSjiIJ0fWK3bcYwyYUbf9+/JcLSo2sG259FuRF75yxIe2u2RLSh62plEsyb
cpD545pvlrKIvwg/1hio999lMnSjj+hfNQ7A+Xm5BWiSzrJ1fR1Oo5rq68kY
1C4K8FUQwP3zEF2YDoqbBEnYaxaH7HUcbc34xQARAQABzSlDcnlwdFVwIFRl
c3RlciA8Y3J5cHR1cC50ZXN0ZXJAZ21haWwuY29tPsLBfwQQAQgAKQUCWP9o
cAYLCQcIAwIJEAbKVT7CRV1wBBUIAgoDFgIBAhkBAhsDAh4BAAoJEAbKVT7C
RV1wL8EP/iGk15uGa6gNYdjfoGElIjZCyp1VWTU3VSkkQhLxzWWmB6mQyuZj
vU0SpW89OGyJXoX2M7dDFuuQJmZub7adek0810FaRb9WBmxRZKJe6kdnIc13
Z2zgs9e9ltHCq1rvHsVa+F0dQu0elFXJJbX6LqvyRnuKQxcGLIZbi/GXswgl
g3p6OsuSSSa/fKGylrUjMNPtF6jKhbEz9/5Be+3Fn3memhO07oKtr0SFYNQr
mg2Sp6xmDwVm8GGQO69DEyxBzDZtzVhnJgOgWcgKli3u6HBvvg1pVwtgLEnF
KoNug9qZoeNPPdv4ueHnE4cM1ZrWsnFqLusexO4RKgxhnQ+UaK1SeRahDKuD
bAYreN5aFex6KNUeCFum1QDSKhRlL9FUtDAPPu3HtVDfbWgu+tn/YnUXzQWN
MovbuYaIp0qyaC5f+PPZ4cqi++B8npUoIStkLrGrxwnvQVbB0fh9JMLMwzLV
4wwSbZCkSPRXCv0H71ODr71SjTUm5M9c2l6xiNmDruKdwhyvmkApbkdz4ZXV
VEg0e8E/2rH1sTB+N47h/gtJF6J0asnu3A7Pt8IuKn6ycPxmLcAtCX82vzpc
rshPtQJVaRASle4BvuoikyJdhuQ5wTf7XX3JCzUrGA1W8u/mmVdwrVb7oX3g
IzfWJbjamWQUg6jspvPAVLBBSzncwS22zsFNBFj/aG8BEACilSpjULG6TZYb
hWcnR46n/gGgQULCW/UO8y0rlAAZgS1BvfqIUnW9bbCOTBKuy3ZLMtrBeCrG
OigR4NFSuDXbvCks3lRZYBEsos68rf2vCWnf3Wro2HSeX5YlceOl2ALlV0To
XrND5aWvGkBsFLpm1f7NiDV6qPB8A5HtFCONvpPzhtkpJIixk1NlEtzjJPOW
1qKh4vX2JJjO2EyUbenSYMI6nr3yLxBVI4d4uoqRUsKfgdbkt/0x7XP4tOus
FmcCFm9GdZ7AIVaYpC+nJGi4hIZL1BJC/5qk3yL9MCQLALEb1ymb5jvKkKyq
vFEKwA43zEj/+LHKIYrsIz0WKqbdzcqq5YgnE0VmUwS14+8NRNpuGXAHkVBR
b9S4XCz5Ed7gaJsWqCqm8E+g+uLM/ml6KSDKKXLFhX+uMxZ2AQCTe7WDpiEE
DB+WmRjVfvL+rlrz6YBMwBULrQ1Fa9rbQCH8ivhz7ue6RzgAedTfpdOHp/Vl
3lJk9XKqamlwClfXBB96EZKQUc+cGiFtS5hJVm7m4xFimXywfDYLxjLANJTK
rGmlXVdLMKHoUB7r1yEL9XngSyv7AC9/1QkrTMJFvIH2i/PmxCgyvpeCXdZo
V2vlQMs0wBLE08gGmD92NX0efeSwPGBwbH7uLoGM6nO/+9RMbxPu0vJHQb9M
DonpFrO81QARAQABwsFpBBgBCAATBQJY/2hzCRAGylU+wkVdcAIbDAAKCRAG
ylU+wkVdcMWLD/97wA3viAjYsP7zbuvfvjb9qxDvomeozrcYNPdz1Ono3mLs
czEHD4p1w+4SBAdYAN2kMFw+1EaRBQP23Laa28axhKDbsb8c/JvY5hIt/osX
sxA9seXRES8iPIYq8zSNXqx8ZADUOR9jkR1tAhqpqYHvcZmsbW+bBdhHg0EV
ge2qEPFy84k0NOVM1Fwj3nsblym9ZLrx3YWQIceVJGxl0u3UmSdNpR0JgCuC
QlItExJY8DBYMVmk8kkd/uWQSBTWq6qXf/vARKEMqp+aA5gPMFngrQfL/yNI
emIRaWAXoXwqXQcJGz4BGGgBuX8zjldvT5sOnfTEokygeSg7K95ZlbPYwdvT
QhLMOUoQF7YysI8l7qIdUW2qM8zepn3eHIhpgq7QfwdzceWpgHma683zQUVf
sU09dzg2IihGnk13oXaq8wye4P4Cw4oKBDgpxNrwmh7j5wnxtreuLMrjmS0+
+8k3NJ4HpmP2tIiIX2JThrj1ANSb2bMZIvH+kW0niR8WqJWzqG1u2hs4EoWN
RWuEm0qwW6TtrChMDpyX3K135ID5TFJ2pvpwUerliNH4LBEAbQcXZt13pe9i
1mePDNOQzBhDMbfRA8VOnL+e77I7CUB5GK/YQw1YoeOc1VamrACkYYfMVX6D
XZ8r4OC6sguP/yozWlkG+7dDxsgKQVBENeG6Lw==
=1oxZ
-----END PGP PUBLIC KEY BLOCK-----`,
          'sender@domain.com'
        );
        // as the verification pubkey is not known, this scenario doesn't trigger message re-fetch
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          msgId,
          {
            content: [],
            encryption: 'not encrypted',
            signature: 'error verifying signature: Signed digest did not match',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [everdesk] message encrypted for sub but claims encryptedFor:primary,sub`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16d558cb71e8d510',
          {
            content: ['this is a sample for FlowCrypt compatibility'],
            encryption: 'encrypted',
            signature: 'not signed',
          },
          authHdr
        );
      })
    );

    test(
      `decrypt - [pep] pgp/mime message with text encoded as inline attachment`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16ff09b1baca2051',
          {
            content: ['Subject: Re: Test from Tom iOS', 'test again', 'A message', 'Testing'],
            encryption: 'encrypted',
            signature: 'could not verify signature: missing pubkey A4556258EFD7EE07',
            quoted: true,
          },
          authHdr
        );
      })
    );

    test(
      'decrypt - by entering pass phrase + remember in session',
      testWithBrowser(async (t, browser) => {
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const pp = Config.key('flowcrypt.compatibility.1pp1').passphrase;
        const threadId = '15f7f5630573be2d';
        const expectedContent = 'The International DUBLIN Literary Award is an international literary award';
        const settingsPage = await browser.newExtensionSettingsPage(t);
        await SettingsPageRecipe.forgetAllPassPhrasesInStorage(settingsPage, pp);
        // requires pp entry
        await InboxPageRecipe.checkDecryptMsg(t, browser, {
          acctEmail,
          threadId,
          expectedContent,
          enterPp: {
            passphrase: Config.key('flowcrypt.compatibility.1pp1').passphrase,
            isForgetPpChecked: true,
            isForgetPpHidden: false,
          },
        });
        // now remembers pp in session
        await InboxPageRecipe.checkDecryptMsg(t, browser, { acctEmail, threadId, expectedContent });
        // Finish session and check if it's finished
        await InboxPageRecipe.checkFinishingSession(t, browser, acctEmail, threadId);
      })
    );

    test(
      'decrypt - display email with cid image correctly',
      testWithBrowser(async (t, browser) => {
        const threadId = '186eed032659ad4f';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        await pgpBlock.checkIfImageIsDisplayedCorrectly('#pgp_block img');
        const replyFrame = await inboxPage.getFrame(['compose.htm']);
        await replyFrame.waitAndClick('@action-forward');
        await replyFrame.waitForContent('@input-body', 'googlelogo_color_272x92dp.png'); // check if forwarded content contains cid image name
      })
    );

    test(
      "decrypt - thunderbird - signedHtml verifyDetached doesn't duplicate PGP key section",
      testWithBrowser(async (t, browser) => {
        const threadId = '17daefa0eb077da6';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        const urls = await inboxPage.getFramesUrls(['pgp_pubkey.htm'], { sleep: 3 });
        expect(urls.length).to.be.lessThan(2);
        // todo: mock gmail page
      })
    );

    test(
      'decrypt - print feature in pgp block',
      testWithBrowser(async (t, browser) => {
        const threadId = '182917712be838e1';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        // todo: test mock gmail page
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        const printPage = await browser.newPageTriggeredBy(t, () => pgpBlock.click('@action-print'));
        await printPage.waitForContent('@print-user-email', 'First Last <flowcrypt.compatibility@gmail.com>');
        await printPage.waitForContent('@print-subject', 'Test print dialog');
        await printPage.waitForContent('@print-from', 'From: sender@domain.com');
        await printPage.waitForContent('@print-to', 'To: flowcrypt.compatibility@gmail.com');
        await printPage.waitForContent('@print-cc', 'ci.tests.gmail@flowcrypt.dev');
        await printPage.waitForContent('@print-content', 'Test print message');
      })
    );

    test(
      "decrypt - thunderbird - signedMsg verifyDetached doesn't duplicate PGP key section",
      testWithBrowser(async (t, browser) => {
        const threadId = '17dad75e63e47f97';
        const { authHdr, acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        const expectedMessage = {
          signature: 'could not verify signature: missing pubkey 203FAE7076005381',
          encryption: 'not encrypted',
          content: ['1234'],
        };
        await BrowserRecipe.pgpBlockCheck(t, pgpBlock, expectedMessage);
        const urls = await inboxPage.getFramesUrls(['pgp_pubkey.htm'], { sleep: 3 });
        expect(urls.length).to.be.equal(1);
        await inboxPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${threadId}`, undefined, authHdr);
        await gmailPage.waitAll('iframe');
        const pgpBlockFromGmailPage = await gmailPage.getFrame(['pgp_block.htm']);
        await pgpBlockFromGmailPage.waitForSelTestState('ready');
        await BrowserRecipe.pgpBlockCheck(t, pgpBlockFromGmailPage, expectedMessage);
        const frameUrlsFromGmailPage = await gmailPage.getFramesUrls(['pgp_pubkey.htm'], { sleep: 3 });
        expect(frameUrlsFromGmailPage.length).to.be.equal(1);
      })
    );

    test(
      'decrypt - thunderbird - signing key is rendered in signed and encrypted message',
      testWithBrowser(async (t, browser) => {
        const threadId = '175adb163ac0d69b';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        const urls = await inboxPage.getFramesUrls(['pgp_pubkey.htm'], { sleep: 3 });
        expect(urls.length).to.be.equal(1);
      })
    );

    test(
      'decrypt - thunderbird - signed text is recognized',
      testWithBrowser(async (t, browser) => {
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup!['some.sender@test.com'] = { pubkey: await get203FAE7076005381() };
        const threadId = '17dad75e63e47f97';
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe', { timeout: 2 });
        const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
        expect(urls.length).to.equal(1);
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame([urls[0]]), {
          content: ['1234'],
          encryption: 'not encrypted',
          signature: 'signed',
        });
        // todo: check gmail mock
      })
    );

    test(
      'verification - message text is rendered prior to pubkey fetching',
      testWithBrowser(async (t, browser) => {
        const msgId = '17dad75e63e47f97';
        const senderEmail = 'some.sender@test.com';
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup![senderEmail] = {
          pubkey: await get203FAE7076005381(),
          delayInSeconds: 5,
        };
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${msgId}`, undefined, authHdr);
        const pgpBlockPage = await gmailPage.getFrame(['pgp_block.htm']);
        await pgpBlockPage.waitForContent('@pgp-block-content', '1234', 4, 10);
        await pgpBlockPage.waitForContent('@pgp-signature', 'verifying signature...', 3, 10);
        await pgpBlockPage.waitForContent('@pgp-signature', 'signed', 10, 10);
      })
    );

    test(
      'verification - public key fetched from WKD',
      testWithBrowser(async (t, browser) => {
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.wkd = {
          directLookup: {
            'some.sender': {
              pubkeys: [await get203FAE7076005381()],
            },
          },
        };
        const threadId = '17dad75e63e47f97';
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe', { timeout: 2 });
        const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
        expect(urls.length).to.equal(1);
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame([urls[0]]), {
          content: ['1234'],
          encryption: 'not encrypted',
          signature: 'signed',
        });
        expect(await inboxPage.read('@message-line')).to.not.include('1234');
        // todo: check gmail mock
      })
    );
    test(
      'decrypt - fetched pubkey is automatically saved to contacts',
      testWithBrowser(async (t, browser) => {
        const msgId = '17dad75e63e47f97';
        const senderEmail = 'some.sender@test.com';
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup![senderEmail] = { pubkey: await get203FAE7076005381() };
        const acctAttr = acctEmail.replace(/[\.@]/g, '');
        const senderAttr = senderEmail.replace(/[\.@]/g, '');
        {
          const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
          await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
          const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
          await contactsFrame.waitAll('@page-contacts');
          await Util.sleep(1);
          expect(await contactsFrame.isElementPresent(`@action-show-email-${acctAttr}`)).to.be.true;
          expect(await contactsFrame.isElementPresent(`@action-show-email-${senderAttr}`)).to.be.false;
        }
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          msgId,
          {
            content: ['1234'],
            encryption: 'not encrypted',
            signature: 'signed',
          },
          authHdr
        );
        {
          const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
          await SettingsPageRecipe.toggleScreen(settingsPage, 'additional');
          const contactsFrame = await SettingsPageRecipe.awaitNewPageFrame(settingsPage, '@action-open-contacts-page', ['contacts.htm', 'placement=settings']);
          await contactsFrame.waitAll('@page-contacts');
          await Util.sleep(1);
          expect(await contactsFrame.isElementPresent(`@action-show-email-${acctAttr}`)).to.be.true;
          expect(await contactsFrame.isElementPresent(`@action-show-email-${senderAttr}`)).to.be.true;
          await contactsFrame.waitAndClick(`@action-show-email-${senderAttr}`);
          // contains the  newly fetched key
          await contactsFrame.waitForContent('@page-contacts', 'openpgp - active - 2BB2 1977 6F23 CE48 EBB8 609C 203F AE70 7600 5381');
        }
      })
    );

    test(
      'decrypt - unsigned encrypted message',
      testWithBrowser(async (t, browser) => {
        const threadId = '17918a9d7ca2fbac';
        const expectedMessage = {
          content: ['This is unsigned, encrypted message'],
          encryption: 'encrypted',
          signature: 'not signed',
        };
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe');
        const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 3 });
        expect(urls.length).to.equal(1);
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame([urls[0]]), expectedMessage);
        await inboxPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${threadId}`, undefined, authHdr);
        await gmailPage.waitAll('iframe', { timeout: 2 });
        const frameUrlsFromGmailPage = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
        expect(frameUrlsFromGmailPage.length).to.equal(1);
        await BrowserRecipe.pgpBlockCheck(t, await gmailPage.getFrame([frameUrlsFromGmailPage[0]]), expectedMessage);
      })
    );

    test(
      'signature - sender is different from pubkey uid',
      testWithBrowser(async (t, browser) => {
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup!['sender@example.com'] = {
          pubkey: testConstants.pubkey2864E326A5BE488A,
        };
        const threadId = '1766644f13510f58';
        // todo: test with gmail mock page
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe', { timeout: 2 });
        const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
        expect(urls.length).to.equal(1);
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame(['pgp_block.htm']), {
          content: ['How is my message signed?'],
          encryption: 'not encrypted',
          signature: 'signed',
        });
      })
    );

    test(
      'signature - verification succeeds when signed with a second-best key',
      testWithBrowser(async (t, browser) => {
        const threadId = '1766644f13510f58';
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup!['sender@example.com'] = {
          pubkey: testConstants.pubkey2864E326A5BE488A,
        };
        await PageRecipe.addPubkey(
          t,
          browser,
          acctEmail,
          '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nVersion: FlowCrypt Email Encryption [BUILD_REPLACEABLE_VERSION]\r\nComment: Seamlessly send and receive encrypted email\r\n\r\nxjMEYZeW2RYJKwYBBAHaRw8BAQdAT5QfLVP3y1yukk3MM/oiuXLNe1f9az5M\r\nBnOlKdF0nKnNJVNvbWVib2R5IDxTYW1zNTBzYW1zNTBzZXB0QEdtYWlsLkNv\r\nbT7CjwQQFgoAIAUCYZeW2QYLCQcIAwIEFQgKAgQWAgEAAhkBAhsDAh4BACEJ\r\nEMrSTYqLk6SUFiEEBP90ux3d6kDwDdzvytJNiouTpJS27QEA7pFlkLfD0KFQ\r\nsH/dwb/NPzn5zCi2L9gjPAC3d8gv1fwA/0FjAy/vKct4D7QH8KwtEGQns5+D\r\nP1WxDr4YI2hp5TkAzjgEYZeW2RIKKwYBBAGXVQEFAQEHQKNLY/bXrhJMWA2+\r\nWTjk3I7KhawyZfLomJ4hovqr7UtOAwEIB8J4BBgWCAAJBQJhl5bZAhsMACEJ\r\nEMrSTYqLk6SUFiEEBP90ux3d6kDwDdzvytJNiouTpJQnpgD/c1CzfS3YzJUx\r\nnFMrhjiE0WVgqOV/3CkfI4m4RA30QUIA/ju8r4AD2h6lu3Mx/6I6PzIRZQty\r\nLvTkcu4UKodZa4kK\r\n=7C4A\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n',
          'sender@example.com'
        );
        // todo: make sure pubkey2864E326A5BE488A isn't present in ContactStore yet
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${threadId}`, undefined, authHdr);
        await gmailPage.waitAll('iframe', { timeout: 2 });
        const frameUrlsFromGmailPage = await gmailPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
        expect(frameUrlsFromGmailPage.length).to.equal(1);
        const expectedMessage = {
          content: ['How is my message signed?'],
          encryption: 'not encrypted',
          signature: 'signed',
        };
        await BrowserRecipe.pgpBlockCheck(t, await gmailPage.getFrame([frameUrlsFromGmailPage[0]]), expectedMessage);
        await gmailPage.close();
        // todo: remove pubkey2864E326A5BE488A from ContactStore
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        await inboxPage.waitAll('iframe', { timeout: 2 });
        const urls = await inboxPage.getFramesUrls(['/chrome/elements/pgp_block.htm'], { sleep: 10, appearIn: 20 });
        expect(urls.length).to.equal(1);
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame([urls[0]]), expectedMessage);
      })
    );

    test(
      'decrypt - protonmail - PGP/inline signed and encrypted message with pubkey - pubkey signature is ignored',
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm'); // todo: url?
        // add the pubkey of the sender
        await dbPage.page.evaluate(async (pubkey: string) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const key = await (window as any).KeyUtil.parse(pubkey);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (window as any).ContactStore.update(undefined, 'schlemazle@proton.me', { pubkey: key });
        }, testConstants.protonPubkey);
        await dbPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/1869220e0c8f16dd`, undefined, authHdr);
        await gmailPage.waitAll('iframe');
        const pgpBlock = await gmailPage.getFrame(['pgp_block.htm']);
        await BrowserRecipe.pgpBlockCheck(t, pgpBlock, {
          content: ['Sent with Proton Mail secure email.'],
          encryption: 'encrypted',
          signature: 'signed',
        });
        await gmailPage.close();
      })
    );

    test(
      'decrypt - protonmail - PGP/inline signed and encrypted message with pubkey - pubkey signature is ignored - inbox',
      testWithBrowser(async (t, browser) => {
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        const threadId = '1869220e0c8f16dd';
        let inboxPage = await browser.newExtensionInboxPage(t, acctEmail, threadId);
        await inboxPage.waitAll('iframe');
        expect((await inboxPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(1);
        expect(await (await inboxPage.getFrame(['pgp_pubkey.htm'])).isElementVisible('@action-add-contact')).to.be.true;
        expect((await inboxPage.getFramesUrls(['attachment.htm'])).length).to.equal(0); // invisible
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame(['pgp_block.htm']), {
          content: ['Sent with Proton Mail secure email.'],
          encryption: 'encrypted',
          signature: 'could not verify signature: missing pubkey 616D596BC2065D48',
        });
        await inboxPage.close();
        const dbPage = await browser.newExtensionPage(t, 'chrome/dev/ci_unit_test.htm');
        // add the pubkey of the sender
        await dbPage.page.evaluate(async (pubkey: string) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const key = await (window as any).KeyUtil.parse(pubkey);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (window as any).ContactStore.update(undefined, 'schlemazle@proton.me', { pubkey: key });
        }, testConstants.protonPubkey);
        await dbPage.close();
        inboxPage = await browser.newExtensionInboxPage(t, acctEmail, threadId);
        await inboxPage.waitAll('iframe');
        expect((await inboxPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(1);
        expect(await (await inboxPage.getFrame(['pgp_pubkey.htm'])).isElementVisible('@action-add-contact')).to.be.true;
        expect((await inboxPage.getFramesUrls(['attachment.htm'])).length).to.equal(0); // invisible
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame(['pgp_block.htm']), {
          content: ['Sent with Proton Mail secure email.'],
          encryption: 'encrypted',
          signature: 'signed',
        });
        t.pass();
      })
    );

    test(
      'decrypt - public key is rendered minimized for outgoing messages',
      testWithBrowser(async (t, browser) => {
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        const threadId = '1869220e0c8f16de';
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail, threadId);
        await inboxPage.waitAll('iframe');
        expect((await inboxPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(1);
        expect((await inboxPage.getFramesUrls(['attachment.htm'])).length).to.equal(0); // invisible
        const pubkeyFrame1 = await inboxPage.getFrame(['pgp_pubkey.htm']);
        expect(await pubkeyFrame1.isElementVisible('@action-add-contact')).to.be.false; // should be hidden because the sender matches acctEmail
        await inboxPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${threadId}`, undefined, authHdr);
        await gmailPage.waitAll('iframe');
        expect((await gmailPage.getFramesUrls(['pgp_block.htm'])).length).to.equal(1);
        expect((await gmailPage.getFramesUrls(['attachment.htm'])).length).to.equal(0); // invisible
        const pubkeyFrame2 = await gmailPage.getFrame(['pgp_pubkey.htm']);
        expect(await pubkeyFrame2.isElementVisible('@action-add-contact')).to.be.false; // should be hidden because the sender matches acctEmail
      })
    );

    test(
      'signature - cleartext signed messages from HTML are re-fetched when needed',
      testWithBrowser(async (t, browser) => {
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'ci.tests.gmail');
        const settingsPage = await browser.newExtensionSettingsPage(t, acctEmail);
        await settingsPage.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/1866867cfdb8b61e`, undefined, authHdr);
        await gmailPage.waitAll('iframe');
        const pgpBlocks = await Promise.all((await gmailPage.getFramesUrls(['pgp_block.htm'])).map(url => gmailPage.getFrame([url])));
        expect(pgpBlocks.length).to.equal(3);
        await BrowserRecipe.pgpBlockCheck(t, pgpBlocks[0], {
          content: ['this is message 3 for flowcrypt issue 4342'],
          encryption: 'not encrypted',
          signature: 'signed',
        });
        // should re-fetch the correct text/plain text with signature
        await BrowserRecipe.pgpBlockCheck(t, pgpBlocks[1], {
          content: ['this is message 1 for flowcrypt issue 4342'],
          unexpectedContent: ['this is message 1 CORRUPTED for flowcrypt issue 4342'],
          encryption: 'not encrypted',
          signature: 'signed',
        });
        await BrowserRecipe.pgpBlockCheck(t, pgpBlocks[2], {
          content: ['this is message 2 for flowcrypt issue 4342'],
          encryption: 'not encrypted',
          signature: 'signed',
        });
        await gmailPage.close();
      })
    );

    test(
      'decrypt - signed-only PGP/MIME message is processed from API, rendered html is ignored',
      testWithBrowser(async (t, browser) => {
        const msgId = '17daefa0eb077da6';
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        const signerEmail = 'some.sender@test.com';
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: {
            pubkeyLookup: {
              [acctEmail]: {
                pubkey: somePubkey,
              },
              [signerEmail]: {
                pubkey: await get203FAE7076005381(),
              },
            },
          },
          google: { htmlRenderer: () => 'Some corrupted message' },
        });
        const { authHdr } = await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          msgId,
          {
            content: ['1234'],
            encryption: 'not encrypted',
            signature: 'signed',
          },
          authHdr
        );
      })
    );

    test(
      'decrypt - signed-only PGP/MIME message - text is rendered only once in inbox',
      testWithBrowser(async (t, browser) => {
        const msgId = '17daefa0eb077da6';
        const signerEmail = 'some.sender@test.com';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup![signerEmail] = { pubkey: await get203FAE7076005381() };
        const inboxPage = await browser.newExtensionInboxPage(t, acctEmail, msgId);
        await inboxPage.waitAll('iframe');
        await BrowserRecipe.pgpBlockCheck(t, await inboxPage.getFrame(['pgp_block.htm']), {
          content: ['1234'],
          encryption: 'not encrypted',
          signature: 'signed',
        });
        expect(await inboxPage.read('@message-line')).to.not.include('1234');
      })
    );

    test(
      'decrypt - protonmail - load pubkey into contact + verify detached msg',
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup!['flowcrypt.compatibility@protonmail.com'] = { pubkey: protonMailCompatKey };
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16a9c109bc51687d',
          {
            content: ['1234'],
            encryption: 'not encrypted',
            signature: 'could not verify signature: missing pubkey 7ED43D79E9617655',
          },
          authHdr
        );
        await PageRecipe.addPubkey(t, browser, 'flowcrypt.compatibility@gmail.com', testConstants.protonCompatPub, 'some.alias@protonmail.com');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16a9c109bc51687d',
          {
            content: ['1234'],
            encryption: 'not encrypted',
            signature: 'signed',
          },
          authHdr
        );
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16a9c0fe4e034bc2',
          {
            content: ['1234'],
            encryption: 'not encrypted',
            signature: 'signed',
          },
          authHdr
        );
      })
    );

    test(
      'decrypt - protonmail - auto TOFU load matching pubkey first time',
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup!['some.alias@protonmail.com'] = { pubkey: protonMailCompatKey };
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '16a9c109bc51687d',
          {
            content: ['1234'],
            encryption: 'not encrypted',
            signature: 'signed',
          },
          authHdr
        );
      })
    );

    test(
      'decrypt - verify encrypted+signed message',
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup!['martin@politick.ca'] = { pubkey: mpVerificationKey };
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1617429dc55600db',
          {
            content: ['4) signed + encrypted email if supported'],
            encryption: 'encrypted',
            signature: 'signed',
          },
          authHdr
        );
      })
    );

    test(
      'decrypt - load key - expired key',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(
          testConstants.expiredPub
        )}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
        const pubFrame = await browser.newPage(t, pubFrameUrl);
        await pubFrame.waitAll('@action-add-contact');
        expect((await pubFrame.read('@action-add-contact'))?.toLowerCase()).to.include('expired');
        await pubFrame.click('@action-add-contact');
        await Util.sleep(1);
        await pubFrame.close();
      })
    );

    test(
      'decrypt - load key - unusable key',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const pubFrameUrl = `chrome/elements/pgp_pubkey.htm?frameId=none&armoredPubkey=${encodeURIComponent(
          testConstants.unusableKey
        )}&acctEmail=flowcrypt.compatibility%40gmail.com&parentTabId=0`;
        const pubFrame = await browser.newPage(t, pubFrameUrl);
        await Util.sleep(1);
        await pubFrame.notPresent('@action-add-contact');
        expect((await pubFrame.read('#pgp_block.pgp_pubkey'))?.toLowerCase()).to.include('not usable');
        await pubFrame.close();
      })
    );

    test(
      'decrypt - wrong message - checksum throws error',
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const threadId = '15f7ffb9320bd79e';
        const expectedContent = 'Ascii armor integrity check failed';
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          threadId,
          {
            content: [expectedContent],
            error: 'decrypt error',
          },
          authHdr
        );
      })
    );

    test(
      'decrypt - inbox - encrypted message inside signed',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility%40gmail.com&threadId=16f0bfce331ca2fd');
        await inboxPage.waitAll('iframe.pgp_block');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        const content = await pgpBlock.read('#pgp_block');
        expect(content).to.include(
          '-----BEGIN PGP MESSAGE-----Version: FlowCrypt 7.4.2 Gmail\nEncryptionComment: Seamlessly send and receive encrypted\nemailwcFMA0taL/zmLZUBAQ/+Kj48OQND'
        );
      })
    );

    test(
      'decrypt - inbox - check for rel="noopener noreferrer" attribute in PGP/MIME links',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility%40gmail.com&threadId=1762c9a49bedbf6f');
        await inboxPage.waitAll('iframe.pgp_block');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        const htmlContent = await pgpBlock.readHtml('#pgp_block');
        expect(htmlContent).to.include('rel="noopener noreferrer"');
      })
    );

    test(
      'decrypt - inbox - Verify null window.opener object after opening PGP/MIME links',
      testWithBrowser(async (t, browser) => {
        await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newPage(t, 'chrome/settings/inbox/inbox.htm?acctEmail=flowcrypt.compatibility%40gmail.com&threadId=1762c9a49bedbf6f');
        await inboxPage.waitAll('iframe.pgp_block');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        await pgpBlock.click('#pgp_block a');
        await Util.sleep(5);
        const flowcryptTab = (await browser.browser.pages()).find(p => p.url() === 'https://flowcrypt.com/');
        await flowcryptTab!.waitForSelector('body'); // eslint-disable-line @typescript-eslint/no-non-null-assertion
        await Util.sleep(3);
        expect(await flowcryptTab!.evaluate(() => `Opener: ${JSON.stringify(window.opener)}`)).to.equal('Opener: null'); // eslint-disable-line @typescript-eslint/no-non-null-assertion
      })
    );

    test.todo('decrypt - by entering secondary pass phrase');

    test(
      `decrypt - signed only - parse error in a badge`,
      testWithBrowser(async (t, browser) => {
        const acctEmail = 'flowcrypt.compatibility@gmail.com';
        const msgId = '175ccd8755eab85f';
        const data = await GoogleData.withInitializedData(acctEmail);
        // eslint-disable @typescript-eslint/no-non-null-assertion
        const { id, threadId, historyId, payload } = data.getMessage(msgId)!;
        t.mockApi!.configProvider = new ConfigurationProvider({
          attester: singlePubKeyAttesterConfig(acctEmail, somePubkey),
          google: {
            getMsg: {
              [msgId]: { msg: { id, threadId, historyId, payload, raw: 'RSo' } }, // corrupted raw part
            },
          },
        });
        const { authHdr } = await BrowserRecipe.setUpCommonAcct(t, browser, 'compatibility');
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '175ccd8755eab85f',
          {
            content: [],
            error: 'parse error',
          },
          authHdr
        );
      })
    );

    test(
      'decrypt - prevent rendering of attachments from domain sources other than flowcrypt.s3.amazonaws.com',
      testWithBrowser(async (t, browser) => {
        const threadId1 = '184cc6aa8e884397';
        const { acctEmail } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId1}`);
        await inboxPage.waitAll('iframe');
        const pgpBlock = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlock.waitForSelTestState('ready');
        await pgpBlock.waitForContent('@pgp-block-content', '[skipped attachment due to invalid url]');
        await pgpBlock.notPresent(['.preview-attachment', '@download-attachment-0']);
      })
    );

    test(
      `verify - sha1 shows error`,
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        t.mockApi!.configProvider!.config.attester!.pubkeyLookup!['sha1@sign.com'] = { pubkey: sha1signpubkey };
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '1882fa9e2b996242',
          {
            content: ['test'],
            encryption: 'not encrypted',
            signature: 'error verifying signature: Insecure message hash algorithm: SHA1. Sender is using old, insecure OpenPGP software.',
          },
          authHdr
        );
      })
    );

    test(
      'verify - Kraken - urldecode signature',
      testWithBrowser(async (t, browser) => {
        const { authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const expectedContent = 'Kraken clients can now begin converting popular currencies';
        await BrowserRecipe.pgpBlockVerifyDecryptedContent(
          t,
          browser,
          '171d138c8750863b',
          {
            content: [expectedContent],
            encryption: 'not encrypted',
            signature: 'could not verify signature: missing pubkey A38042F607D623DA',
          },
          authHdr
        );
      })
    );

    test(
      'settings - test for warning modal when downloading an executable file',
      testWithBrowser(async (t, browser) => {
        const threadId = '187365d19ec9a10c';
        const threadId2 = '18736a0687a8426b';
        const threadId3 = '187cfc92db548a0c';
        const expectedErrMsg = 'This executable file was not checked for viruses, and may be dangerous to download or run. Proceed anyway?';
        const { acctEmail, authHdr } = await BrowserRecipe.setupCommonAcctWithAttester(t, browser, 'compatibility');
        const inboxPage = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId}`);
        const pgpBlockPage = await inboxPage.getFrame(['pgp_block.htm']);
        await pgpBlockPage.waitAndClick('@download-attachment-0');
        // check warning modal for inline encrypted attachment on FlowCrypt web extension page
        const downloadedFile1 = await inboxPage.awaitDownloadTriggeredByClicking(() =>
          PageRecipe.waitForModalAndRespond(inboxPage, 'confirm', {
            contentToCheck: expectedErrMsg,
            clickOn: 'confirm',
          })
        );
        await pgpBlockPage.waitAndClick('@preview-attachment');
        const attachmentPreviewPage = await inboxPage.getFrame(['attachment_preview.htm']);
        await attachmentPreviewPage.waitAndClick('@attachment-preview-download');
        // check warning modal for regular encrypted attachment on FlowCrypt web extension page
        const downloadedFile2 = await attachmentPreviewPage.awaitDownloadTriggeredByClicking(() =>
          PageRecipe.waitForModalAndRespond(attachmentPreviewPage, 'confirm', {
            contentToCheck: expectedErrMsg,
            clickOn: 'confirm',
          })
        );
        expect(Object.entries([downloadedFile1, downloadedFile2]).length).to.equal(2);
        await inboxPage.close();
        const inboxPage2 = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId2}`);
        const pgpBlockPage2 = await inboxPage2.getFrame(['pgp_block.htm']);
        // todo: glitch? it shows "not encrypted" and "not signed"
        await pgpBlockPage2.waitAndClick('@download-attachment-0');
        // check warning modal for inline signed attachment on FlowCrypt web extension page
        const downloadedFile3 = await inboxPage2.awaitDownloadTriggeredByClicking(() =>
          PageRecipe.waitForModalAndRespond(inboxPage2, 'confirm', {
            contentToCheck: expectedErrMsg,
            clickOn: 'confirm',
          })
        );
        expect(Object.entries(downloadedFile3).length).to.equal(1);
        await inboxPage2.close();
        const gmailPage = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${threadId}`, undefined, authHdr);
        await gmailPage.waitAll('iframe');
        const pgpBlockPage3 = await gmailPage.getFrame(['pgp_block.htm']);
        await pgpBlockPage3.waitAndClick('@download-attachment-0');
        // check warning modal for inline encrypted attachment test on Gmail page
        const downloadedFile4 = await gmailPage.awaitDownloadTriggeredByClicking(() =>
          PageRecipe.waitForModalAndRespond(gmailPage, 'confirm', {
            contentToCheck: expectedErrMsg,
            clickOn: 'confirm',
          })
        );
        const attachmentFrame = await gmailPage.getFrame(['attachment.htm']);
        await attachmentFrame.waitAndClick('@attachment-container');
        const attachmentPreviewPage2 = await gmailPage.getFrame(['attachment_preview.htm']);
        await attachmentPreviewPage2.waitAndClick('@attachment-preview-download');
        // check warning modal for regular encrypted attachment test on Gmail page
        const downloadedFile5 = await gmailPage.awaitDownloadTriggeredByClicking(() =>
          PageRecipe.waitForModalAndRespond(attachmentPreviewPage2, 'confirm', {
            contentToCheck: expectedErrMsg,
            clickOn: 'confirm',
          })
        );
        expect(Object.entries([downloadedFile4, downloadedFile5]).length).to.equal(2);
        await gmailPage.close();
        const gmailPage2 = await browser.newPage(t, `${t.urls?.mockGmailUrl()}/${threadId2}`, undefined, authHdr);
        const pgpBlockPage4 = await gmailPage2.getFrame(['pgp_block.htm']);
        // todo: glitch? it shows "not encrypted" and "not signed"
        await pgpBlockPage4.waitAndClick('@download-attachment-0');
        // check warning modal for inline signed attachment test on Gmail page
        const downloadedFile6 = await gmailPage2.awaitDownloadTriggeredByClicking(() =>
          PageRecipe.waitForModalAndRespond(gmailPage2, 'confirm', {
            contentToCheck: expectedErrMsg,
            clickOn: 'confirm',
          })
        );
        expect(Object.entries(downloadedFile6).length).to.equal(1);
        await gmailPage2.close();
        // check warning modal for regular unencrypted attachment on FlowCrypt web extension page
        const inboxPage3 = await browser.newExtensionPage(t, `chrome/settings/inbox/inbox.htm?acctEmail=${acctEmail}&threadId=${threadId3}`);
        const attachmentFrame2 = await inboxPage3.getFrame(['attachment.htm']);
        await attachmentFrame2.waitAndClick('@download-attachment');
        const downloadedFile7 = await inboxPage3.awaitDownloadTriggeredByClicking(() =>
          PageRecipe.waitForModalAndRespond(inboxPage3, 'confirm', {
            contentToCheck: expectedErrMsg,
            clickOn: 'confirm',
          })
        );
        await attachmentFrame2.waitAndClick('@attachment-container');
        const attachmentPreviewPage3 = await inboxPage3.getFrame(['attachment_preview.htm']);
        await attachmentPreviewPage3.waitAndClick('@attachment-preview-download');
        const downloadedFile8 = await attachmentPreviewPage3.awaitDownloadTriggeredByClicking(() =>
          PageRecipe.waitForModalAndRespond(attachmentPreviewPage3, 'confirm', {
            contentToCheck: expectedErrMsg,
            clickOn: 'confirm',
          })
        );
        expect(Object.entries([downloadedFile7, downloadedFile8]).length).to.equal(2);
      })
    );
  }
};
