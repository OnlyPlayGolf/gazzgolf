import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Crown, Check, Zap, Star, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AccountMembership = () => {
  const navigate = useNavigate();
  const currentPlan: string = "free"; // This would come from user data

  const plans = [
    {
      id: "free",
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Get started with essential features",
      features: [
        "Basic drill tracking",
        "Level progression (first 50 levels)",
        "Basic round tracking",
        "Friends leaderboards"
      ],
      current: currentPlan === "free"
    },
    {
      id: "pro",
      name: "Pro",
      price: "$9.99",
      period: "/month",
      description: "Unlock your full potential",
      features: [
        "Unlimited level access",
        "Advanced strokes gained analytics",
        "Pro Stats detailed tracking",
        "All game formats",
        "Priority support",
        "Ad-free experience"
      ],
      current: currentPlan === "pro",
      popular: true
    },
    {
      id: "coach",
      name: "Coach",
      price: "$29.99",
      period: "/month",
      description: "Perfect for instructors and teams",
      features: [
        "Everything in Pro",
        "Unlimited group members",
        "Player progress dashboards",
        "Custom drill creation",
        "Export player data",
        "Team analytics"
      ],
      current: currentPlan === "coach"
    }
  ];

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/menu")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Membership</h1>
          </div>
        </div>

        {/* Current Plan Status */}
        <Card className="mb-6 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Crown className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Plan</p>
                  <p className="font-semibold text-foreground capitalize">{currentPlan}</p>
                </div>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Active
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Plans */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Available Plans</h2>
          
          {plans.map((plan) => (
            <Card 
              key={plan.id} 
              className={`relative ${plan.popular ? 'border-primary shadow-md' : 'border-border'} ${plan.current ? 'bg-muted/30' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-4">
                  <Badge className="bg-primary text-primary-foreground">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <div className="text-right">
                    <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-sm text-muted-foreground">{plan.period}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-4">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.current ? (
                  <Button disabled className="w-full" variant="secondary">
                    Current Plan
                  </Button>
                ) : (
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.id === "free" ? "Downgrade" : "Upgrade"}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Coming Soon Features */}
        <Card className="mt-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Coming Soon
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Zap className="h-3 w-3" />
                Annual subscription with 20% discount
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-3 w-3" />
                Family plans for up to 5 members
              </li>
              <li className="flex items-center gap-2">
                <Zap className="h-3 w-3" />
                Club partnerships and group discounts
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountMembership;
