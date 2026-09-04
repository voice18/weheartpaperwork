import { readFile } from "node:fs/promises";

const app = JSON.parse(await readFile(new URL("../app.json", import.meta.url), "utf8"));
const plist = await readFile(new URL("../GoogleService-Info.plist", import.meta.url), "utf8");
const android = JSON.parse(await readFile(new URL("../google-services.json", import.meta.url), "utf8"));
const iosBundle = app.expo.ios.bundleIdentifier;
const androidPackage = app.expo.android.package;
const plistBundle = plist.match(/<key>BUNDLE_ID<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
const androidMatches = android.client?.some(
  client => client.client_info?.android_client_info?.package_name === androidPackage
);

const errors = [];
if (plistBundle !== iosBundle) errors.push(`iOS Firebase bundle mismatch: expected ${iosBundle}, found ${plistBundle || "missing"}.`);
if (!androidMatches) errors.push(`Android Firebase configuration has no client for ${androidPackage}.`);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log("Mobile Firebase configuration matches the Expo application identifiers.");
