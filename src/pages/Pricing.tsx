import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Brain } from "lucide-react";
import { useNavigate } from "react-router-dom";

const plans = [
  {
    name: "Starter",
    docs: "50 docs",
    price: "$25",
    period: "/mo",
    description: "Solo or small teams",
    features: [
      "Up to 50 documents",
      "Basic LLM queries",
      "Email support",
      "Standard processing",
    ],
    popular: false,
  },
  {
    name: "Business",
    docs: "200 docs",
    price: "$60",
    period: "/mo",
    description: "SMEs, private KB per user",
    features: [
      "Up to 200 documents",
      "Priority LLM queries",
      "Private knowledge base",
      "Email & chat support",
      "Advanced analytics",
    ],
    popular: true,
  },
  {
    name: "Business+",
    docs: "500 docs",
    price: "$150",
    period: "/mo",
    description: "Priority support + custom workflows",
    features: [
      "Up to 500 documents",
      "Unlimited LLM queries",
      "Custom workflows",
      "Priority support",
      "Dedicated account manager",
      "API access",
    ],
    popular: false,
  },
];

const Pricing = () => {
  const navigate = useNavigate();

  const handleSelectPlan = (planName: string) => {
    navigate("/auth", { state: { selectedPlan: planName } });
  };

  return (
    <div className="min-h-screen gradient-subtle py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary text-white mb-4 shadow-glow">
            <Brain className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the plan that fits your needs. Upgrade or downgrade anytime.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 animate-slide-up" style={{ animationDelay: "0.1s" }}>
          {plans.map((plan) => (
            <Card
              key={plan.name}
              className={`relative flex flex-col transition-all hover:shadow-lg ${
                plan.popular ? "border-primary shadow-lg scale-105" : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="gradient-primary text-white text-sm font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{plan.docs}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-primary flex-shrink-0" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={() => handleSelectPlan(plan.name)}
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  Get Started
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="text-center mt-12 animate-slide-up" style={{ animationDelay: "0.2s" }}>
          <p className="text-muted-foreground">
            All plans include a 14-day free trial. No credit card required.
          </p>
          <Button variant="link" onClick={() => navigate("/auth")} className="mt-2">
            Already have an account? Sign in
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Pricing;
