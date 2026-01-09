import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const SettingsLanguage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [language, setLanguage] = useState(() => 
    localStorage.getItem('appLanguage') || 'en'
  );

  const languages = [
    { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
    { code: 'sv', name: 'Swedish', native: 'Svenska', flag: '🇸🇪' },
    { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
    { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
    { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
  ];

  const handleSave = () => {
    localStorage.setItem('appLanguage', language);
    toast({
      title: "Language updated",
      description: "Your language preference has been saved.",
    });
    navigate("/settings");
  };

  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate("/settings")}
              className="rounded-full flex-shrink-0"
            >
              <ArrowLeft size={20} />
            </Button>
            <h1 className="text-xl font-bold text-foreground">Language</h1>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select Language</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup value={language} onValueChange={setLanguage}>
              {languages.map((lang) => (
                <div 
                  key={lang.code}
                  className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                >
                  <RadioGroupItem value={lang.code} id={lang.code} />
                  <Label htmlFor={lang.code} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{lang.flag}</span>
                      <div>
                        <div className="font-medium">{lang.name}</div>
                        <div className="text-sm text-muted-foreground">{lang.native}</div>
                      </div>
                    </div>
                  </Label>
                  {language === lang.code && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        <div className="mt-4 p-4 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Currently, the app is available in English only. Additional languages will be added in future updates.
          </p>
        </div>

        <Button onClick={handleSave} className="w-full mt-4">
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default SettingsLanguage;
