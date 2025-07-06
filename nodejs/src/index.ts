import * as pulumi from "@pulumi/pulumi";
import * as openstack from "@pulumi/openstack";

export interface CustomSubnetArgs extends Omit<openstack.networking.SubnetArgs, "networkId" | "name"> {
    name: string;
}

export interface CustomRouterRouteArgs extends Omit<openstack.networking.RouterRouteArgs, "routerId"> {
    /* Label inserted into the Pulumi resource name: `${baseName}-route-${description}` */
    description: string;
}

export interface CustomPortArgs extends Omit<openstack.networking.PortArgs, "name"> {
    name: string;
    selfNetwork?: boolean; // default: false
}

export interface RouterWithPortsArgs extends openstack.networking.RouterArgs {
    additionalPorts?: CustomPortArgs[];
}

export interface NetworkArgs extends Omit<openstack.networking.NetworkArgs, "name"> {
    /* Router configuration that will be created and connected to every subnet. */
    routerConfig: RouterWithPortsArgs;
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
    public readonly ports: openstack.networking.Port[] = [];

    private readonly subnetMap: Record<string, openstack.networking.Subnet> = {};
    private readonly baseName: string;

    constructor(name: string, args: NetworkComponentArgs, opts?: pulumi.ComponentResourceOptions) {
        super("okassov:openstack:Network", name, {}, opts);

        const provOpts: pulumi.CustomResourceOptions = { parent: this, provider: opts?.provider };
        this.baseName = name;

        /* Router */
        const { additionalPorts, ...routerArgs } = args.networkConfig.routerConfig;
        const routerName = `${this.baseName}-router`;
        this.router = new openstack.networking.Router(routerName, {
            ...routerArgs,
            name: routerName,
        }, provOpts);

        /* Network */
        const networkName = `${this.baseName}-net`;
        this.network = new openstack.networking.Network(networkName, {
            ...args.networkConfig,
            name: networkName,
            routerConfig: undefined as any,
            subnets: undefined as any,
            routes: undefined as any,
        } as unknown as openstack.networking.NetworkArgs, provOpts);

        /* Subnets + Router Interfaces */
        args.networkConfig.subnets?.forEach(sub => this.createSubnet(sub, provOpts));

        /* Additional Custom Router Ports */
        additionalPorts?.forEach(p => this.createAdditionalPort(p, provOpts));

        /* Static Routes */
        args.networkConfig.routes?.forEach(r => this.createRoute(r, provOpts));

        this.registerOutputs({
            routerId: this.router.id,
            networkId: this.network.id,
            subnetIds: this.subnetIds(),
            portIds: this.ports.map(p => p.id),
        });
    }

    private createSubnet(args: CustomSubnetArgs, opts: pulumi.CustomResourceOptions) {

        const subnetName = `${this.baseName}-subnet-${args.name}`;
        
        /* Create Subnet */
        const subnet = new openstack.networking.Subnet(subnetName, {
            ...args,
            name: subnetName,
            networkId: this.network.id,
        } as openstack.networking.SubnetArgs, { ...opts, parent: this.network });

        this.subnets.push(subnet);
        this.subnetMap[args.name] = subnet;
        
        /* Attach Subnet to Router Interface */
        new openstack.networking.RouterInterface(`${subnetName}-if`, {
            routerId: this.router.id,
            subnetId: subnet.id,
        }, { ...opts, parent: subnet, dependsOn: [this.router] });
    }

    private createAdditionalPort(args: CustomPortArgs, opts: pulumi.CustomResourceOptions) {
        const portName = `${this.baseName}-port-${args.name}`;

        const { selfNetwork = false, networkId, ...portArgs } = args;
        const targetNetworkId = selfNetwork ? this.network.id : networkId;
        if (!targetNetworkId) {
            throw new Error(`Port \"${args.name}\" must specify networkId when selfNetwork=false.`);
        }

        const port = new openstack.networking.Port(portName, {
            ...args,
            name: portName,
            networkId: targetNetworkId,
        } as openstack.networking.PortArgs, { ...opts, parent: this.network });

        this.ports.push(port);

        new openstack.networking.RouterInterface(`${portName}-if`, {
            routerId: this.router.id,
            portId: port.id,
        }, { ...opts, parent: port, dependsOn: [this.router] });
    }

    private createRoute(args: CustomRouterRouteArgs, opts: pulumi.CustomResourceOptions) {
        const { description, ...routeArgs } = args;
        const routeName = `${this.baseName}-route-${description}`;
        new openstack.networking.RouterRoute(routeName, {
            ...routeArgs,
            routerId: this.router.id,
        }, { ...opts, parent: this.router, dependsOn: [...this.subnets, ...this.ports] });
    }

    public subnetId(name: string): pulumi.Output<string> {
        const s = this.subnetMap[name];
        if (!s) throw new Error(`Subnet \"${name}\" not found in component \"${this.baseName}\".`);
        return s.id;
    }

    public subnetIds(): pulumi.Output<string>[] {
        return this.subnets.map(s => s.id);
    }

}

