import roleSelectionKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/screens/RoleSelectionScreen.kt?raw';
import vehicleProfileKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/screens/VehicleProfileScreen.kt?raw';
import tourLeaderKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/screens/TourLeaderScreen.kt?raw';
import joinTourKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/screens/JoinTourScreen.kt?raw';
import liveTrackingMapKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/screens/LiveTrackingMapScreen.kt?raw';
import tripHistoryKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/screens/TripHistoryScreen.kt?raw';
import tripDetailKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/screens/TripDetailScreen.kt?raw';
import aboutAppKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/screens/AboutAppScreen.kt?raw';
import tripSummaryCardRendererKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/components/TripSummaryCardRenderer.kt?raw';
import touringAtmosphereKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/components/TouringAtmosphereBackground.kt?raw';
import navGraphKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/navigation/ConvoyNavGraph.kt?raw';
import convoyAvatarKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/components/ConvoyAvatar.kt?raw';
import viewModelKt from '../../android/app/src/main/java/com/konvoiku/touring/viewmodel/ConvoyViewModel.kt?raw';
import modelsKt from '../../android/app/src/main/java/com/konvoiku/touring/model/ConvoyModels.kt?raw';
import themeKt from '../../android/app/src/main/java/com/konvoiku/touring/ui/theme/Theme.kt?raw';
import mainActivityKt from '../../android/app/src/main/java/com/konvoiku/touring/MainActivity.kt?raw';
import settingsGradleKts from '../../android/settings.gradle.kts?raw';
import rootBuildGradleKts from '../../android/build.gradle.kts?raw';
import libsVersionsToml from '../../android/gradle/libs.versions.toml?raw';
import gradleProperties from '../../android/gradle.properties?raw';
import gradleWrapperProperties from '../../android/gradle/wrapper/gradle-wrapper.properties?raw';
import appBuildGradleKts from '../../android/app/build.gradle.kts?raw';
import proguardRulesPro from '../../android/app/proguard-rules.pro?raw';
import manifestXml from '../../android/app/src/main/AndroidManifest.xml?raw';
import stringsXml from '../../android/app/src/main/res/values/strings.xml?raw';
import themesXml from '../../android/app/src/main/res/values/themes.xml?raw';
import filePathsXml from '../../android/app/src/main/res/xml/file_paths.xml?raw';
import { ScreenRoute } from '../types/convoy';

export interface KotlinSourceFile {
  id: string;
  name: string;
  path: string;
  category: 'Layar Compose' | 'Navigasi & State' | 'Tema & Konfigurasi';
  linkedRoute?: ScreenRoute;
  code: string;
}

export const KOTLIN_SOURCE_FILES: KotlinSourceFile[] = [
  {
    id: 'role_selection',
    name: 'RoleSelectionScreen.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/screens/RoleSelectionScreen.kt',
    category: 'Layar Compose',
    linkedRoute: 'role_selection',
    code: roleSelectionKt,
  },
  {
    id: 'vehicle_profile',
    name: 'VehicleProfileScreen.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/screens/VehicleProfileScreen.kt',
    category: 'Layar Compose',
    linkedRoute: 'vehicle_profile',
    code: vehicleProfileKt,
  },
  {
    id: 'tour_leader',
    name: 'TourLeaderScreen.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/screens/TourLeaderScreen.kt',
    category: 'Layar Compose',
    linkedRoute: 'tour_leader',
    code: tourLeaderKt,
  },
  {
    id: 'join_tour',
    name: 'JoinTourScreen.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/screens/JoinTourScreen.kt',
    category: 'Layar Compose',
    linkedRoute: 'join_tour',
    code: joinTourKt,
  },
  {
    id: 'live_map',
    name: 'LiveTrackingMapScreen.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/screens/LiveTrackingMapScreen.kt',
    category: 'Layar Compose',
    linkedRoute: 'live_map',
    code: liveTrackingMapKt,
  },
  {
    id: 'trip_history',
    name: 'TripHistoryScreen.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/screens/TripHistoryScreen.kt',
    category: 'Layar Compose',
    linkedRoute: 'trip_history',
    code: tripHistoryKt,
  },
  {
    id: 'trip_detail',
    name: 'TripDetailScreen.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/screens/TripDetailScreen.kt',
    category: 'Layar Compose',
    linkedRoute: 'trip_detail',
    code: tripDetailKt,
  },
  {
    id: 'trip_card_renderer',
    name: 'TripSummaryCardRenderer.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/components/TripSummaryCardRenderer.kt',
    category: 'Layar Compose',
    linkedRoute: 'trip_detail',
    code: tripSummaryCardRendererKt,
  },
  {
    id: 'about_app',
    name: 'AboutAppScreen.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/screens/AboutAppScreen.kt',
    category: 'Layar Compose',
    linkedRoute: 'about_app',
    code: aboutAppKt,
  },
  {
    id: 'convoy_avatar',
    name: 'ConvoyAvatar.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/components/ConvoyAvatar.kt',
    category: 'Layar Compose',
    code: convoyAvatarKt,
  },
  {
    id: 'touring_atmosphere',
    name: 'TouringAtmosphereBackground.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/components/TouringAtmosphereBackground.kt',
    category: 'Layar Compose',
    linkedRoute: 'role_selection',
    code: touringAtmosphereKt,
  },
  {
    id: 'nav_graph',
    name: 'ConvoyNavGraph.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/navigation/ConvoyNavGraph.kt',
    category: 'Navigasi & State',
    code: navGraphKt,
  },
  {
    id: 'viewmodel',
    name: 'ConvoyViewModel.kt',
    path: 'app/src/main/java/com/konvoiku/touring/viewmodel/ConvoyViewModel.kt',
    category: 'Navigasi & State',
    code: viewModelKt,
  },
  {
    id: 'models',
    name: 'ConvoyModels.kt',
    path: 'app/src/main/java/com/konvoiku/touring/model/ConvoyModels.kt',
    category: 'Navigasi & State',
    code: modelsKt,
  },
  {
    id: 'theme',
    name: 'Theme.kt',
    path: 'app/src/main/java/com/konvoiku/touring/ui/theme/Theme.kt',
    category: 'Tema & Konfigurasi',
    code: themeKt,
  },
  {
    id: 'main_activity',
    name: 'MainActivity.kt',
    path: 'app/src/main/java/com/konvoiku/touring/MainActivity.kt',
    category: 'Tema & Konfigurasi',
    code: mainActivityKt,
  },
  {
    id: 'settings_gradle',
    name: 'settings.gradle.kts',
    path: 'settings.gradle.kts',
    category: 'Tema & Konfigurasi',
    code: settingsGradleKts,
  },
  {
    id: 'root_build_gradle',
    name: 'build.gradle.kts',
    path: 'build.gradle.kts',
    category: 'Tema & Konfigurasi',
    code: rootBuildGradleKts,
  },
  {
    id: 'libs_versions',
    name: 'libs.versions.toml',
    path: 'gradle/libs.versions.toml',
    category: 'Tema & Konfigurasi',
    code: libsVersionsToml,
  },
  {
    id: 'gradle_properties',
    name: 'gradle.properties',
    path: 'gradle.properties',
    category: 'Tema & Konfigurasi',
    code: gradleProperties,
  },
  {
    id: 'gradle_wrapper',
    name: 'gradle-wrapper.properties',
    path: 'gradle/wrapper/gradle-wrapper.properties',
    category: 'Tema & Konfigurasi',
    code: gradleWrapperProperties,
  },
  {
    id: 'build_gradle',
    name: 'app/build.gradle.kts',
    path: 'app/build.gradle.kts',
    category: 'Tema & Konfigurasi',
    code: appBuildGradleKts,
  },
  {
    id: 'proguard_rules',
    name: 'proguard-rules.pro',
    path: 'app/proguard-rules.pro',
    category: 'Tema & Konfigurasi',
    code: proguardRulesPro,
  },
  {
    id: 'manifest',
    name: 'AndroidManifest.xml',
    path: 'app/src/main/AndroidManifest.xml',
    category: 'Tema & Konfigurasi',
    code: manifestXml,
  },
  {
    id: 'strings_xml',
    name: 'res/values/strings.xml',
    path: 'app/src/main/res/values/strings.xml',
    category: 'Tema & Konfigurasi',
    code: stringsXml,
  },
  {
    id: 'themes_xml',
    name: 'res/values/themes.xml',
    path: 'app/src/main/res/values/themes.xml',
    category: 'Tema & Konfigurasi',
    code: themesXml,
  },
  {
    id: 'file_paths',
    name: 'res/xml/file_paths.xml',
    path: 'app/src/main/res/xml/file_paths.xml',
    category: 'Tema & Konfigurasi',
    code: filePathsXml,
  },
];
