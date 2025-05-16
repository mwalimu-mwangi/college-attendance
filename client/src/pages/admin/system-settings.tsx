import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Info, Settings, Upload, School, FileText, Trash2, Database, AlertTriangle, Loader2, Save, RotateCcw, Clock, FileArchive } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Form schema for system settings
const systemSettingsSchema = z.object({
  defaultAttendanceWindow: z.preprocess(
    (val) => parseInt(val as string, 10) || 30,
    z.number().min(1, "Attendance window must be at least 1 minute")
  ),
  autoDisableAttendance: z.boolean().default(true),
  allowTeacherOverride: z.boolean().default(true),
  emailNotifications: z.boolean().default(true),
  attendanceReminders: z.boolean().default(true),
  lowAttendanceAlerts: z.boolean().default(true),
  schoolName: z.string().optional(),
  schoolLogo: z.string().optional(),
  letterhead: z.string().optional(),
});

type SystemSettingsFormValues = z.infer<typeof systemSettingsSchema>;

export default function AdminSystemSettings() {
  const { toast } = useToast();
  const [isFormDirty, setIsFormDirty] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isDeletingData, setIsDeletingData] = useState(false);
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [selectedBackupFile, setSelectedBackupFile] = useState("");
  const [backupName, setBackupName] = useState("");
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  // Fetch system settings
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/system-settings"],
    queryFn: async () => {
      const response = await fetch("/api/system-settings");
      if (!response.ok) throw new Error("Failed to fetch system settings");
      return response.json();
    },
  });

  // Setup form
  const form = useForm<SystemSettingsFormValues>({
    resolver: zodResolver(systemSettingsSchema),
    defaultValues: {
      defaultAttendanceWindow: 30,
      autoDisableAttendance: true,
      allowTeacherOverride: true,
      emailNotifications: true,
      attendanceReminders: true,
      lowAttendanceAlerts: true,
    },
  });

  // Update form values when settings are loaded
  useState(() => {
    if (settings) {
      form.reset({
        defaultAttendanceWindow: settings.defaultAttendanceWindow,
        autoDisableAttendance: settings.autoDisableAttendance,
        allowTeacherOverride: settings.allowTeacherOverride,
        emailNotifications: settings.emailNotifications,
        attendanceReminders: settings.attendanceReminders,
        lowAttendanceAlerts: settings.lowAttendanceAlerts,
        schoolName: settings.schoolName || "",
        schoolLogo: settings.schoolLogo || "",
        letterhead: settings.letterhead || "",
      });
    }
  });

  // Watch for form changes
  useState(() => {
    const subscription = form.watch(() => {
      setIsFormDirty(true);
    });
    return () => subscription.unsubscribe();
  });

  // Update system settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (data: SystemSettingsFormValues) => {
      const response = await apiRequest("PUT", "/api/system-settings", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "System settings updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/system-settings"] });
      setIsFormDirty(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Fetch backups
  const { data: backups, isLoading: isLoadingBackups, refetch: refetchBackups } = useQuery({
    queryKey: ["/api/system/backups"],
    queryFn: async () => {
      const response = await fetch("/api/system/backups");
      if (!response.ok) throw new Error("Failed to fetch backup list");
      const data = await response.json();
      return data.backups || [];
    }
  });
  
  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async (name: string) => {
      return await apiRequest("POST", "/api/system/backups", { name });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Backup created successfully.",
      });
      setIsBackupDialogOpen(false);
      setIsCreatingBackup(false);
      setBackupName("");
      refetchBackups();
    },
    onError: (error) => {
      setIsCreatingBackup(false);
      toast({
        title: "Error",
        description: error.message || "Failed to create backup",
        variant: "destructive",
      });
    }
  });
  
  // Restore from backup mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      return await apiRequest("POST", "/api/system/backups/restore", { 
        filename,
        confirm: 'yes-restore-data'
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "System restored from backup successfully.",
      });
      setIsRestoreDialogOpen(false);
      setIsRestoring(false);
      // Force reload of the page to reflect changes
      window.location.href = '/';
    },
    onError: (error) => {
      setIsRestoring(false);
      toast({
        title: "Error",
        description: error.message || "Failed to restore from backup",
        variant: "destructive",
      });
      setIsRestoreDialogOpen(false);
    }
  });
  
  // Delete backup mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (filename: string) => {
      return await apiRequest("DELETE", `/api/system/backups/${encodeURIComponent(filename)}`);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Backup deleted successfully.",
      });
      refetchBackups();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete backup",
        variant: "destructive",
      });
    }
  });
  
  // Clear data mutation
  const clearDataMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/system/clear-data", { confirm: 'yes-delete-all-data' });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "System data has been cleared successfully. The admin user has been preserved.",
      });
      setIsConfirmDialogOpen(false);
      setIsDeletingData(false);
      // Force reload of the page to reflect changes
      window.location.href = '/';
    },
    onError: (error) => {
      setIsDeletingData(false);
      toast({
        title: "Error",
        description: error.message || "Failed to clear system data",
        variant: "destructive",
      });
      setIsConfirmDialogOpen(false);
    }
  });

  const onSubmit = (data: SystemSettingsFormValues) => {
    updateSettingsMutation.mutate(data);
  };

  const handleClearData = () => {
    setIsDeletingData(true);
    clearDataMutation.mutate();
  };
  
  const handleCreateBackup = () => {
    setIsCreatingBackup(true);
    createBackupMutation.mutate(backupName || `manual-backup`);
  };
  
  const handleRestoreBackup = () => {
    if (!selectedBackupFile) {
      toast({
        title: "Error",
        description: "Please select a backup file to restore from",
        variant: "destructive",
      });
      return;
    }
    
    setIsRestoring(true);
    restoreBackupMutation.mutate(selectedBackupFile);
  };
  
  const handleDeleteBackup = (filename: string) => {
    if (window.confirm(`Are you sure you want to delete the backup: ${filename}?`)) {
      deleteBackupMutation.mutate(filename);
    }
  };
  
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch (e) {
      return dateStr;
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <DashboardLayout>
      <div className="fade-in">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-neutral-500 mb-2">System Settings</h2>
          <p className="text-neutral-300">Configure global settings for the attendance system</p>
        </div>
        
        <Card>
          <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
            <div className="flex items-center">
              <Settings className="mr-2 h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium text-neutral-500">System Configuration</h3>
            </div>
            
            {isFormDirty && (
              <Alert className="py-2 px-4 max-w-md bg-amber-50 text-amber-800 border-amber-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You have unsaved changes
                </AlertDescription>
              </Alert>
            )}
          </div>
          <CardContent className="p-6">
            {settingsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div>
                    <h4 className="text-md font-medium text-neutral-500 mb-4">Attendance Settings</h4>
                    
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="defaultAttendanceWindow"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Attendance Window (minutes)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min={1}
                                {...field}
                                onChange={(e) => field.onChange(e.target.value)}
                                value={field.value.toString()}
                              />
                            </FormControl>
                            <FormDescription>
                              The default time window in minutes during which students can mark attendance after a lesson starts.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="autoDisableAttendance"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Auto-disable Attendance Marking</FormLabel>
                              <FormDescription>
                                Automatically disable attendance marking after the attendance window time has passed.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="allowTeacherOverride"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Allow Teacher Override</FormLabel>
                              <FormDescription>
                                Allow teachers to override the attendance window and mark attendance for students manually.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="text-md font-medium text-neutral-500 mb-4">Notification Settings</h4>
                    
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="emailNotifications"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Email Notifications</FormLabel>
                              <FormDescription>
                                Enable system-wide email notifications for important events.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="attendanceReminders"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Attendance Reminders</FormLabel>
                              <FormDescription>
                                Send reminders to students to mark their attendance for upcoming lessons.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="lowAttendanceAlerts"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Low Attendance Alerts</FormLabel>
                              <FormDescription>
                                Alert teachers and administrators when a student's attendance falls below a certain threshold.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h4 className="text-md font-medium text-neutral-500 mb-4">School Branding</h4>
                    
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="schoolName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>School Name</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Enter school name"
                              />
                            </FormControl>
                            <FormDescription>
                              School name to display on reports and the application header
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="schoolLogo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>School Logo URL</FormLabel>
                            <div className="flex gap-4 items-start">
                              <FormControl>
                                <div className="flex-1">
                                  <Input
                                    {...field}
                                    placeholder="Enter URL to school logo"
                                  />
                                </div>
                              </FormControl>
                              {field.value && (
                                <div className="w-16 h-16 rounded-md overflow-hidden border border-neutral-200">
                                  <img 
                                    src={field.value} 
                                    alt="School Logo Preview" 
                                    className="w-full h-full object-contain"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDIyQzE3LjUgMjIgMjIgMTcuNSAyMiAxMkMyMiA2LjUgMTcuNSAyIDEyIDJDNi41IDIgMiA2LjUgMiAxMkMyIDE3LjUgNi41IDIyIDEyIDIyWiIgc3Ryb2tlPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik05LjE3IDguODNMMTEuOTIgMTEuNThMOS4xNyAxNC4zMyIgc3Ryb2tlPSIjOTk5OTk5IiBzdHJva2Utd2lkdGg9IjEuNSIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CjxwYXRoIGQ9Ik0xNC44MyAxNC4zM0wxMi4wOCAxMS41OEwxNC44MyA4LjgzIiBzdHJva2U9IiM5OTk5OTkiIHN0cm9rZS13aWR0aD0iMS41IiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+Cg==";
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                            <FormDescription>
                              URL to your school logo image. This will appear on reports and the application
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="letterhead"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Letterhead URL</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Enter URL to letterhead image"
                              />
                            </FormControl>
                            <FormDescription>
                              URL to your letterhead image that will appear at the top of printed reports
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                  
                  <Alert className="bg-blue-50 text-blue-800 border-blue-200">
                    <Info className="h-4 w-4" />
                    <AlertTitle>Information</AlertTitle>
                    <AlertDescription>
                      These settings affect the entire system. Changes will take effect immediately.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={updateSettingsMutation.isPending || !isFormDirty}
                      className="bg-primary hover:bg-primary-dark text-white"
                    >
                      {updateSettingsMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>

        <div className="mt-8">
          <Card>
            <div className="px-6 py-4 border-b border-neutral-200 flex items-center">
              <Database className="mr-2 h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium text-neutral-500">System Maintenance</h3>
            </div>
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <h4 className="text-md font-medium text-neutral-500">Data Management</h4>
                  <p className="text-neutral-400 text-sm">
                    These actions will affect system data. Please use with caution.
                  </p>
                </div>

                <Tabs defaultValue="clear" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="clear">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Clear Data
                    </TabsTrigger>
                    <TabsTrigger value="backup">
                      <FileArchive className="h-4 w-4 mr-2" />
                      Backup & Restore
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Clear Data Tab */}
                  <TabsContent value="clear" className="mt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex flex-col space-y-4">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-2" />
                          <div>
                            <h5 className="font-medium text-red-800">Clear System Data</h5>
                            <p className="text-red-700 text-sm mt-1">
                              This will reset all data in the system except for the admin account and system settings.
                              All departments, classes, teachers, students, lessons, and attendance records will be permanently deleted.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-end">
                          <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="destructive" size="sm">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Clear All Data
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle className="text-red-600">Confirm Data Deletion</DialogTitle>
                                <DialogDescription>
                                  This action cannot be undone. This will permanently delete all departments, 
                                  classes, teachers, students, lessons, and attendance records from the system.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="bg-amber-50 p-3 rounded-md border border-amber-200 mt-2">
                                <p className="text-amber-800 text-sm">
                                  <AlertCircle className="h-4 w-4 inline-block mr-2" />
                                  The admin account and system settings will be preserved.
                                </p>
                              </div>
                              <DialogFooter className="mt-4">
                                <Button 
                                  variant="outline" 
                                  onClick={() => setIsConfirmDialogOpen(false)}
                                  disabled={isDeletingData}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  onClick={handleClearData}
                                  disabled={isDeletingData}
                                >
                                  {isDeletingData ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Clearing Data...
                                    </>
                                  ) : (
                                    "Yes, Clear All Data"
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  
                  {/* Backup & Restore Tab */}
                  <TabsContent value="backup" className="mt-4 space-y-6">
                    {/* Create Backup Section */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex flex-col space-y-4">
                        <div className="flex items-start">
                          <Save className="h-5 w-5 text-blue-500 mt-0.5 mr-2" />
                          <div>
                            <h5 className="font-medium text-blue-800">Create System Backup</h5>
                            <p className="text-blue-700 text-sm mt-1">
                              Create a backup of all system data that can be restored later.
                              This includes all departments, classes, teachers, students, lessons, and attendance records.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex justify-between items-center">
                          <div className="w-2/3">
                            <Input
                              placeholder="Backup name (optional)"
                              value={backupName}
                              onChange={(e) => setBackupName(e.target.value)}
                            />
                            <p className="text-xs text-blue-700 mt-1">
                              If not specified, a default name with the current date will be used.
                            </p>
                          </div>
                          
                          <Dialog open={isBackupDialogOpen} onOpenChange={setIsBackupDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="default" size="sm">
                                <Save className="mr-2 h-4 w-4" />
                                Create Backup
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Create System Backup</DialogTitle>
                                <DialogDescription>
                                  This will create a backup of all system data. The backup can be used to restore the system if needed.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="mt-2">
                                <p>Backup name: <strong>{backupName || "Default (current date)"}</strong></p>
                              </div>
                              <DialogFooter className="mt-4">
                                <Button 
                                  variant="outline" 
                                  onClick={() => setIsBackupDialogOpen(false)}
                                  disabled={isCreatingBackup}
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  variant="default" 
                                  onClick={handleCreateBackup}
                                  disabled={isCreatingBackup}
                                >
                                  {isCreatingBackup ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Creating Backup...
                                    </>
                                  ) : (
                                    "Create Backup"
                                  )}
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>

                    {/* Available Backups Section */}
                    <div className="border rounded-lg p-4">
                      <div className="flex flex-col space-y-4">
                        <div className="flex items-start">
                          <FileArchive className="h-5 w-5 text-neutral-500 mt-0.5 mr-2" />
                          <div>
                            <h5 className="font-medium">Available Backups</h5>
                            <p className="text-neutral-500 text-sm mt-1">
                              Select a backup to restore or delete.
                            </p>
                          </div>
                        </div>
                        
                        {isLoadingBackups ? (
                          <div className="flex justify-center py-4">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                          </div>
                        ) : backups && backups.length > 0 ? (
                          <div className="border rounded-md">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Filename</TableHead>
                                  <TableHead>Created</TableHead>
                                  <TableHead>Size</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {backups.map((backup: any) => (
                                  <TableRow key={backup.filename}>
                                    <TableCell className="font-medium">
                                      {backup.filename}
                                    </TableCell>
                                    <TableCell>
                                      {formatDate(backup.created)}
                                    </TableCell>
                                    <TableCell>
                                      {formatFileSize(backup.size)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-2">
                                        <Dialog open={isRestoreDialogOpen && selectedBackupFile === backup.filename} 
                                                onOpenChange={(open) => {
                                                  if (!open) setSelectedBackupFile("");
                                                  setIsRestoreDialogOpen(open);
                                                }}>
                                          <DialogTrigger asChild>
                                            <Button 
                                              variant="outline" 
                                              size="sm"
                                              onClick={() => setSelectedBackupFile(backup.filename)}
                                            >
                                              <RotateCcw className="h-3.5 w-3.5 mr-1" />
                                              Restore
                                            </Button>
                                          </DialogTrigger>
                                          <DialogContent>
                                            <DialogHeader>
                                              <DialogTitle className="text-amber-600">Restore System from Backup</DialogTitle>
                                              <DialogDescription>
                                                This will restore your system from the selected backup.
                                                All current data will be replaced with the data from this backup.
                                              </DialogDescription>
                                            </DialogHeader>
                                            <div className="bg-amber-50 p-3 rounded-md border border-amber-200 mt-2">
                                              <p className="text-amber-800 text-sm">
                                                <AlertCircle className="h-4 w-4 inline-block mr-2" />
                                                A backup of the current system state will be created automatically before restoration.
                                              </p>
                                            </div>
                                            <div className="mt-2">
                                              <p>Selected backup: <strong>{selectedBackupFile}</strong></p>
                                              <p>Created: <strong>{formatDate(backup.created)}</strong></p>
                                            </div>
                                            <DialogFooter className="mt-4">
                                              <Button 
                                                variant="outline" 
                                                onClick={() => {
                                                  setSelectedBackupFile("");
                                                  setIsRestoreDialogOpen(false);
                                                }}
                                                disabled={isRestoring}
                                              >
                                                Cancel
                                              </Button>
                                              <Button 
                                                variant="default" 
                                                onClick={handleRestoreBackup}
                                                disabled={isRestoring}
                                              >
                                                {isRestoring ? (
                                                  <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Restoring...
                                                  </>
                                                ) : (
                                                  "Restore System"
                                                )}
                                              </Button>
                                            </DialogFooter>
                                          </DialogContent>
                                        </Dialog>
                                        
                                        <Button 
                                          variant="destructive" 
                                          size="sm"
                                          onClick={() => handleDeleteBackup(backup.filename)}
                                          disabled={backup.filename.startsWith('pre-restore')}
                                        >
                                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                                          Delete
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-8 border rounded-md bg-neutral-50">
                            <FileArchive className="h-12 w-12 mx-auto text-neutral-300 mb-2" />
                            <p className="text-neutral-500">No backups available.</p>
                            <p className="text-neutral-400 text-sm mt-1">Create a backup to see it here.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
