const fs = require('node:fs');
const path = require('node:path');

const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('@expo/config-plugins');

const RATIONALE_ACTION = 'androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE';
const VIEW_USAGE_ACTION = 'android.intent.action.VIEW_PERMISSION_USAGE';
const HEALTH_CATEGORY = 'android.intent.category.HEALTH_PERMISSIONS';
const PROVIDER_PACKAGE = 'com.google.android.apps.healthdata';
const ACTIVITY_NAME = '.HealthConnectPrivacyActivity';
const ALIAS_NAME = '.HealthConnectPermissionUsageActivity';
const PRIVACY_URL = 'https://www.dadhealth.co.uk/privacy';

function withHealthConnectPrivacy(config) {
  const configuredPackageName = config.android?.package;
  config = withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifestConfig.modResults);

    for (const activity of application.activity ?? []) {
      activity['intent-filter'] = (activity['intent-filter'] ?? []).filter(
        (filter) => !hasAction(filter, RATIONALE_ACTION),
      );
    }

    application.activity = (application.activity ?? []).filter(
      (activity) => activity.$?.['android:name'] !== ACTIVITY_NAME,
    );
    application.activity.push({
      $: {
        'android:name': ACTIVITY_NAME,
        'android:exported': 'true',
      },
      'intent-filter': [intentFilter(RATIONALE_ACTION)],
    });

    application['activity-alias'] = (application['activity-alias'] ?? []).filter(
      (alias) => alias.$?.['android:name'] !== ALIAS_NAME
        && !(alias['intent-filter'] ?? []).some((filter) => hasAction(filter, VIEW_USAGE_ACTION)),
    );
    application['activity-alias'].push({
      $: {
        'android:name': ALIAS_NAME,
        'android:exported': 'true',
        'android:targetActivity': `${configuredPackageName}${ACTIVITY_NAME}`,
        'android:permission': 'android.permission.START_VIEW_PERMISSION_USAGE',
      },
      'intent-filter': [intentFilter(VIEW_USAGE_ACTION, HEALTH_CATEGORY)],
    });

    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];
    queries.package = queries.package ?? [];
    if (!queries.package.some((item) => item.$?.['android:name'] === PROVIDER_PACKAGE)) {
      queries.package.push({ $: { 'android:name': PROVIDER_PACKAGE } });
    }

    return manifestConfig;
  });

  return withDangerousMod(config, [
    'android',
    async (modConfig) => {
      const packageName = AndroidConfig.Package.getPackage(modConfig) ?? modConfig.android?.package;
      if (!packageName) throw new Error('Android package name is required for Health Connect privacy configuration.');

      const sourceDirectory = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'java',
        ...packageName.split('.'),
      );
      fs.mkdirSync(sourceDirectory, { recursive: true });
      fs.writeFileSync(
        path.join(sourceDirectory, 'HealthConnectPrivacyActivity.kt'),
        kotlinSource(packageName),
        'utf8',
      );
      return modConfig;
    },
  ]);
}

function hasAction(filter, actionName) {
  return (filter.action ?? []).some((action) => action.$?.['android:name'] === actionName);
}

function intentFilter(actionName, categoryName) {
  return {
    action: [{ $: { 'android:name': actionName } }],
    ...(categoryName ? { category: [{ $: { 'android:name': categoryName } }] } : {}),
  };
}

function kotlinSource(packageName) {
  return `package ${packageName}

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle

class HealthConnectPrivacyActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("${PRIVACY_URL}")))
    finish()
  }
}
`;
}

module.exports = withHealthConnectPrivacy;
