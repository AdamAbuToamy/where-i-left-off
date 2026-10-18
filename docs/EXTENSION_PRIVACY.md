# Where I Left Off — Extension Privacy Policy

Effective date: October 18, 2026

Publisher: Adam Abu Toamy

This policy covers the desktop Chrome extension “Where I Left Off — Save this page”, version 0.2.1. The extension opens the Where I Left Off companion web application. Account and cloud-storage functions belong to that application, rather than to the extension itself.

## Information accessed after your click

Only when you click the extension, it reads the current page's title and URL. It attempts to read the current time and duration of an accessible HTML5 video on that page and checks whether the page indicates a YouTube advertisement. It does not read form inputs, passwords, cookies, general page text, other tabs, or browsing history in the background. A URL or page title may itself contain personal or sensitive information.

## How information is used and transmitted

The selected title (up to 100 characters), URL (up to 500 characters), and available video checkpoint and resource type are encoded in a URL opened at https://where-i-left-off.web.app/ over HTTPS. For supported YouTube links, a timestamp is added. The capture is used to save or prefill a project card in the companion application. The extension requests automatic saving; if signed in, the application may save the item without another confirmation. If not signed in, authentication is handled by the application.

The destination URL can appear in browser history and may be processed by normal website hosting, network, and diagnostic systems. Do not use the extension to capture private-token links or sensitive URLs you do not want sent to the application. The extension has no separate analytics, advertising, third-party tracking SDK, or extension-owned persistent database. It does not download video content or bypass protected players.

## Companion application and service providers

The companion application uses Google Firebase hosting, authentication, and database services. Signing in and saving data involves the application's account and cloud-storage processing. This extension policy does not replace a complete privacy policy for those application features. The extension itself does not access your password or authentication cookies. Captured content is sent to the companion service to provide the save feature, rather than to advertising or data-broker services.

## Retention and your choices

The extension does not retain a separate copy after opening the capture URL. Saved cards are managed in the companion application; use its editing/deletion controls for saved items. You can remove capture URLs from your browser history and uninstall the extension at any time. Uninstalling the extension does not delete cards already saved in your web account. For account-data requests or questions about server retention, contact the publisher through the project support channel. Do not include private links or credentials in a public issue.

## Limited Use

The extension's use of information received from Google APIs adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements. Extension-captured information is used to provide the described save feature, is not sold, is not used for advertising or unrelated purposes, and is not used to determine creditworthiness or lending eligibility.

## Contact and changes

Project support: https://github.com/AdamAbuToamy/where-i-left-off/issues

For questions, open a general support request without posting sensitive information. The publisher should keep a working support contact on the store listing. This policy will be updated if the extension's data practices change.
