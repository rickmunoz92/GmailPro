# Label reminder Google connection

Development setup is configured for local testing. Production OAuth setup and
public verification remain pending.
Never enter a client secret, access token, or refresh token in the source tree.

## Local setup status

- Development project: `gmail-pro-dev-514403`, with Gmail API enabled and billing
  confirmed disabled. Google Auth is External / Testing, with the owner's
  personal and work test accounts allowed and only `gmail.readonly` declared.
- The user confirmed unpacked extension ID `kkddeggjgdhlihdkingjkmahonjipcfd`
  and source folder `/Users/rmunoz/Documents/GmailPro`. Its public Chrome
  Extension client ID is saved in `google-oauth.json` and the development
  manifest. No client secret is needed.
- Privacy pages are live in Netlify deploy `6af3f631f9b124cc439abcf1`.
  Both new-policy routes and the prior immutable policy were verified.
- Google connection is optional and used only for label cleanup reminders.
  Other features work without connecting, including after permission is
  declined. Settings explain this before the user chooses Connect.
- The owner reloaded the extension, reviewed the disclosure, connected the
  personal Gmail account and confirmed label checks completed after the
  empty-response handling fix. Live zz controls, the empty-label popover,
  Hide/restore and persistence after a full Gmail refresh were verified.
  Test was left visible and the original Inbox restored. Remaining release
  checks are recorded in `tests/labelReminders-QA.md`. Google notes new OAuth
  settings can take several minutes or longer to propagate.
- The first work-profile connection returned Google's “Service has been
  disabled for this account” error before any label checks. The work address
  was added to the test-user allowlist and the same error persisted on retry.
  An account or Workspace policy may require administrator approval. This
  cause has not been confirmed in the organization's admin console; no
  organizational access controls were changed. The user-facing error now
  explains the account restriction and that other Gmail Pro features work.

## Production setup and repeatable procedure

1. Use owner-controlled **Gmail Pro** Google Cloud projects for development and production, separate from other products. Enable Gmail API. [Google's Workspace setup guide](https://developers.google.com/workspace/guides/get-started) says supported Workspace APIs do not require Cloud Billing. One console new-project screen required a billing-account selection, but that is not proof billing is required for this feature. Use the documented unbilled project-creation route (`gcloud projects create` or Resource Manager API) instead of linking billing merely to get past that form. [Project creation documentation](https://docs.cloud.google.com/resource-manager/docs/creating-managing-projects) explains that the API creates a project without automatically associating a billing account. No billing account was selected or linked during implementation.
2. Configure Google Auth branding/audience for Gmail Pro. Use the existing homepage, support, privacy and terms URLs. Start in Testing and add only the accounts needed for local validation. Declare `https://www.googleapis.com/auth/gmail.readonly`. The connected user must grant this scope explicitly; other Gmail Pro tools work without a Google connection.
3. Create a **Chrome Extension** OAuth client in each corresponding development/production project. Confirm the actual IDs in Chrome/store details first. The recorded development ID is `kkddeggjgdhlihdkingjkmahonjipcfd`; the store ID is `aemijichdmmlihokhlianpllklnjnnfm`. Keep the canonical unpacked identity; do not add a different manifest public key or remove existing extension storage.
4. Save the public client IDs using:

   ```sh
   node scripts/configure-google-oauth.cjs --development-client-id DEVELOPMENT_CLIENT_ID --store-client-id STORE_CLIENT_ID
   ```

   This updates `google-oauth.json` and the development manifest. Store packaging substitutes only the store client ID in its staging directory. `node scripts/configure-google-oauth.cjs --check` reports missing configuration; packaging is blocked until the production client exists.

5. Publish the prepared privacy notice at `/legal/privacy-2026-11-10-1` and `/privacy` before the updated consent version goes live. Do not edit older immutable policy snapshots. Website publication and Chrome Web Store submission are separate release actions.
6. Reload the unpacked extension and refresh Gmail. Review the updated disclosure, open **Label cleanup reminders → Connect Google**, and complete Google's read-only authorization. Confirm the displayed account matches Gmail. Use **Check now** for a cold retrospective scan, then refresh to confirm cached zz suggestions and dismissals persist.
7. Verify one old label, a parent with an active grandchild, an empty leaf, a supported system row, Hide/restore, and light/dark appearance. Compare warm Gmail startup/navigation/scrolling with reminders on/off before release. Test revocation, wrong-account connection and an API error without hiding anything automatically.

Public distribution requires Google's applicable restricted-scope OAuth verification and Chrome Web Store permission/privacy review. Keep Google API data and tokens off the billing server. Google's review determines any additional assessment requirement; third-party assessments can carry recurring fees, so do not promise a zero-cost public release before that determination. See [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) and [assessment costs](https://support.google.com/cloud/answer/13463817?hl=en). Check the project's current quota and billing controls before public rollout: Google documents standard Gmail API usage at no additional cost, an 80-million-unit daily courtesy threshold and future charges above it. Configure a hard project limit below the applicable free threshold where available; do not opt into paid quota increases without the owner's approval. The worker separately limits requests to 80 quota units/second per Chrome profile, below the current 6,000 units/user/minute limit. See [Gmail quotas](https://developers.google.com/workspace/gmail/api/reference/quota). Do not claim successful live validation or public readiness from synthetic fixtures alone.
