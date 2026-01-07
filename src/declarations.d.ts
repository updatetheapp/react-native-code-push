/**
 * Type declarations for external modules without TypeScript support.
 */

declare module 'code-push/script/acquisition-sdk' {
  import type { HttpAdapter, CodePushConfiguration, QueryPackage, Package, UpdateInfo } from './types';

  export class AcquisitionManager {
    constructor(httpAdapter: HttpAdapter, config: CodePushConfiguration);

    queryUpdateWithCurrentPackage(
      queryPackage: QueryPackage,
      callback: (error: Error | null, update?: UpdateInfo | null) => void
    ): void;

    reportStatusDeploy(
      deployedPackage: Package | null,
      status: string | null,
      previousLabelOrAppVersion: string | undefined,
      previousDeploymentKey: string | undefined,
      callback: (error: Error | null) => void
    ): void;

    reportStatusDownload(
      downloadedPackage: Package,
      callback: (error: Error | null) => void
    ): void;
  }
}

declare module 'hoist-non-react-statics' {
  import { ComponentType } from 'react';

  function hoistNonReactStatics<T extends ComponentType<unknown>, S extends ComponentType<unknown>>(
    TargetComponent: T,
    SourceComponent: S,
    blacklist?: { [key: string]: boolean }
  ): T & S;

  export = hoistNonReactStatics;
}
