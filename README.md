# OpenStack Network Module for Pulumi [![npm version](https://badge.fury.io/js/%40okassov%2Fpulumi-openstack-network.svg)](https://www.npmjs.com/package/%40okassov%2Fpulumi-openstack-network) [![License: MPL-2.0](https://img.shields.io/badge/License-MPL%202.0-brightgreen.svg)](https://mozilla.org/MPL/2.0/) [![Pulumi Registry](https://img.shields.io/badge/Pulumi-Registry-blueviolet.svg)](https://www.pulumi.com/registry/packages/openstack/)

This project provides Pulumi components for provisioning **OpenStack networking** resources using TypeScript. It offers higher‑level constructs on top of the Pulumi OpenStack provider, enabling you to easily create and manage:

- [Network](https://www.pulumi.com/registry/packages/openstack/api-docs/networking/network)
- [Router](https://www.pulumi.com/registry/packages/openstack/api-docs/networking/router)
- [Subnet](https://www.pulumi.com/registry/packages/openstack/api-docs/networking/subnet)
- [RouterInterface](https://www.pulumi.com/registry/packages/openstack/api-docs/networking/routerinterface)
- [RouterRoute](https://www.pulumi.com/registry/packages/openstack/api-docs/networking/routerroute)

A [CHANGELOG][changelog] is maintained for this project.

---

## Installation

### Node.js (NPM/Yarn)

Install the package via **npm**:

```sh
npm install --save "@okassov/pulumi-openstack-network"
```

Install the package via **yarn**:

```sh
yarn add "@okassov/pulumi-openstack-network"
```

---

## Requirements

- Node.js >= 14.x
- Pulumi >= 3.x
- Valid OpenStack credentials and API endpoint

---

## Authentication

Before using the module, ensure your OpenStack environment variables are set:

```sh
export OS_AUTH_URL=https://openstack.example.com:5000/v3
export OS_USERNAME=myuser
export OS_PASSWORD=mypass
export OS_PROJECT_NAME=myproject
```

Alternatively, configure Pulumi to use your OpenStack credentials:

```sh
pulumi config set openstack:authURL https://openstack.example.com:5000/v3
pulumi config set openstack:userName myuser
pulumi config set openstack:password mypass --secret
pulumi config set openstack:tenantName myproject
```

---

## Usage

### How to use

```ts
import * as pulumi from "@pulumi/pulumi";
import * as openstack from "@pulumi/openstack";
import { Network } from "@okassov/pulumi-openstack-network";
```

### Example that creates an OpenStack Network topology

```ts
// Base variables for naming
const baseVars = { env: "dev", project: "example" };
const resourceName = `${baseVars.env}-${baseVars.project}`;

// OpenStack provider (optional if you already have one)
const provider = new openstack.Provider("os", {
  cloud: "mycloud",   // name in clouds.yaml
  region: "RegionOne",
});

// Create VPC‑like network with two subnets and default route
const vpc = new Network(resourceName, {
  networkConfig: {
    adminStateUp: true,

    routerConfig: {
      adminStateUp: true,
      externalNetworkId: "public-net-id",
    },

    subnets: [
      {
        name: "private",
        cidr: "10.0.0.0/24",
        ipVersion: 4,
        enableDhcp: true,
      },
      {
        name: "dmz",
        cidr: "10.0.1.0/24",
        ipVersion: 4,
        enableDhcp: true,
      },
    ],

    routes: [
      {
        destinationCidr: "0.0.0.0/0",
        nextHop: "10.0.0.1",
      },
    ],
  },
}, { provider });

export const routerId  = vpc.router.id;
export const networkId = vpc.network.id;
export const subnetIds = vpc.subnetIds();
```

---

## License

This package is licensed under the [Mozilla Public License, v2.0][mpl2].

---

## Contributing

Please feel free to open issues or pull requests on GitHub!

[changelog]: https://github.com/okassov/pulumi-openstack-network/blob/master/CHANGELOG.md
[pulumi]: https://pulumi.io
[mpl2]: https://www.mozilla.org/en-US/MPL/2.0/
