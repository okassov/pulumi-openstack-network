import * as pulumi from "@pulumi/pulumi";
import * as openstack from "@pulumi/openstack";

export interface CustomSubnetArgs extends Omit<openstack.networking.SubnetArgs, "networkId" | "name"> {
    name: string;
}

export interface CustomRouterRouteArgs extends Omit<openstack.networking.RouterRouteArgs, "routerId"> {}

export interface NetworkArgs extends Omit<openstack.networking.NetworkArgs, "name"> {
    /* Router configuration that will be created and connected to every subnet. */
    routerConfig: openstack.networking.RouterArgs;
    /* One or more subnets to create inside the network. */
    subnets?: CustomSubnetArgs[];
    /* Optional static routes to be added to the router *after* at least one interface is present. */
    routes?: CustomRouterRouteArgs[];
}

export interface NetworkComponentArgs {
    /* Main configuration block for the network, router and subordinate resources. */
    networkConfig: NetworkArgs;
}

export class Network extends pulumi.ComponentResource {

    public readonly router: openstack.networking.Router;
    public readonly network: openstack.networking.Network;
    public readonly subnets: openstack.networking.Subnet[] = [];

    constructor(name: string, args: NetworkComponentArgs, opts?: pulumi.ComponentResourceOptions) {
        super("okassov:openstack:Network", name, {}, opts);

        const provOpts = { parent: this, provider: opts?.provider } as pulumi.CustomResourceOptions;
        const baseName = name; // used as name prefix

        /* Router */
        const routerName = `${baseName}-router`;
        this.router = new openstack.networking.Router(routerName, {
            ...args.networkConfig.routerConfig,
            name: routerName,
        }, provOpts);

        /* Network */
        const networkName = `${baseName}-net`;
        this.network = new openstack.networking.Network(networkName, {
            ...args.networkConfig,
            name: networkName,
            routerConfig: undefined as any,
            subnets: undefined as any,
            routes: undefined as any,
        } as unknown as openstack.networking.NetworkArgs, provOpts);

        /* Subnets + Router Interfaces */
        args.networkConfig.subnets?.forEach((subnetCfg, idx) =>
            this.createSubnet(`${baseName}-subnet-${idx + 1}`, subnetCfg, provOpts));

        /* Static Routes */
        args.networkConfig.routes?.forEach((routeCfg, idx) =>
            this.createRoute(`${baseName}-route-${idx + 1}`, routeCfg, provOpts));

        this.registerOutputs({
            routerId: this.router.id,
            networkId: this.network.id,
            subnetIds: this.subnets.map(s => s.id),
        });
    }

    private createSubnet(name: string, args: CustomSubnetArgs, opts: pulumi.CustomResourceOptions) {

        const subnetName = `${name}-${args.name}`;
        
        /* Create Subnet */
        const subnet = new openstack.networking.Subnet(subnetName, {
            ...args,
            name: subnetName,
            networkId: this.network.id,
        } as openstack.networking.SubnetArgs, { ...opts, parent: this.network });

        this.subnets.push(subnet);
        
        /* Attach Subnet to Router Interface */
        new openstack.networking.RouterInterface(`${subnetName}-if`, {
            routerId: this.router.id,
            subnetId: subnet.id,
        }, { ...opts, parent: subnet, dependsOn: [this.router] });
    }

    private createRoute(name: string, args: CustomRouterRouteArgs, opts: pulumi.CustomResourceOptions) {
        return new openstack.networking.RouterRoute(name, {
            ...args,
            routerId: this.router.id,
        }, { ...opts, parent: this.router, dependsOn: this.subnets });
    }

    public subnetIds(): pulumi.Output<string>[] {
        return this.subnets.map(s => s.id);
    }
}

