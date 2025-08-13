import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../components/Layout/Layout';
import { EnvironmentVariable } from '../types';
import { PlusCircle, Trash2, Save } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { cn } from '../lib/utils';

// --- API Fetcher Functions ---
const API_BASE_URL = 'http://localhost:3001/api';

const fetchVariables = async (): Promise<EnvironmentVariable[]> => {
  const response = await fetch(`${API_BASE_URL}/variables`);
  if (!response.ok) throw new Error('Failed to fetch variables');
  const data = await response.json();
  return data;
};

const createOrUpdateVariable = async (variable: Omit<EnvironmentVariable, 'id' | 'lastModified'> & { id?: string }): Promise<EnvironmentVariable> => {
  const existingVar = await fetch(`${API_BASE_URL}/variables?key=${variable.key}`).then(res => res.json()).then(data => data[0]);

  const method = existingVar ? 'PATCH' : 'POST';
  const url = existingVar ? `${API_BASE_URL}/variables/${existingVar.id}` : `${API_BASE_URL}/variables`;

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(variable),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || `Failed to ${existingVar ? 'update' : 'create'} variable`);
  }
  return response.json();
};

const deleteVariable = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/variables/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to delete variable');
  }
};

// --- Zod Validation Schemas ---
const ecrVariableSchema = z.object({
  ecrRepoName: z.string().min(1, 'ECR Repository Name is required'),
  ecrRegion: z.string().min(1, 'AWS Region is required'),
});

const ecsVariableSchema = z.object({
  ecsClusterName: z.string().min(1, 'ECS Cluster Name is required'),
  ecsServiceName: z.string().min(1, 'ECS Service Name is required'),
  ecsTaskName: z.string().min(1, 'ECS Task Name is required'),
  ecsRegion: z.string().min(1, 'AWS Region is required'),
});

const customVariableSchema = z.object({
  id: z.string().optional(), // Add optional ID for updates
  key: z.string()
    .min(1, 'Key is required')
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Key must be uppercase and can only contain letters, numbers, and underscores'),
  value: z.string().min(1, 'Value is required'),
  description: z.string().optional(),
});

type EcrFormValues = z.infer<typeof ecrVariableSchema>;
type EcsFormValues = z.infer<typeof ecsVariableSchema>;
type CustomFormValues = z.infer<typeof customVariableSchema>;

// --- Component ---
const Variables: React.FC = () => {
  const queryClient = useQueryClient();
  const [showEcrForm, setShowEcrForm] = useState(false);
  const [showEcsForm, setShowEcsForm] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const { data: variables = [], isLoading, error } = useQuery<EnvironmentVariable[]>({ 
    queryKey: ['envVariables'], 
    queryFn: fetchVariables 
  });

  const { 
    register: registerEcr, 
    handleSubmit: handleSubmitEcr, 
    formState: { errors: ecrErrors },
    reset: resetEcrForm,
    setValue: setEcrValue,
  } = useForm<EcrFormValues>({ resolver: zodResolver(ecrVariableSchema) });

  const { 
    register: registerEcs, 
    handleSubmit: handleSubmitEcs, 
    formState: { errors: ecsErrors },
    reset: resetEcsForm,
    setValue: setEcsValue,
  } = useForm<EcsFormValues>({ resolver: zodResolver(ecsVariableSchema) });

  const {
    register: registerCustom,
    control: controlCustom,
    handleSubmit: handleSubmitCustom,
    formState: { errors: customErrors },
    reset: resetCustomForm,
  } = useForm<{ customVars: CustomFormValues[] }>({ 
    resolver: zodResolver(z.object({ customVars: z.array(customVariableSchema) })) 
  });

  const { fields, append, remove } = useFieldArray({ control: controlCustom, name: 'customVars' });

  useEffect(() => {
    if (variables.length > 0) {
      const ecrRepo = variables.find(v => v.key === 'ECR_REPOSITORY_NAME');
      const ecsCluster = variables.find(v => v.key === 'ECS_CLUSTER_NAME');
      const ecsService = variables.find(v => v.key === 'ECS_SERVICE_NAME');
      const ecsTask = variables.find(v => v.key === 'ECS_TASK_NAME');
      const awsRegion = variables.find(v => v.key === 'AWS_REGION');

      if (ecrRepo) setEcrValue('ecrRepoName', ecrRepo.value);
      if (ecsCluster) setEcsValue('ecsClusterName', ecsCluster.value);
      if (ecsService) setEcsValue('ecsServiceName', ecsService.value);
      if (ecsTask) setEcsValue('ecsTaskName', ecsTask.value);
      if (awsRegion) {
        setEcrValue('ecrRegion', awsRegion.value);
        setEcsValue('ecsRegion', awsRegion.value);
      }
    }
  }, [variables, setEcrValue, setEcsValue]);

  const saveMutation = useMutation({
    mutationFn: createOrUpdateVariable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envVariables'] });
      setShowEcrForm(false);
      setShowEcsForm(false);
      setShowCustomForm(false);
      resetEcrForm();
      resetEcsForm();
      resetCustomForm({ customVars: [] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVariable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['envVariables'] });
    },
  });

  const getVarByKey = (key: string) => variables.find(v => v.key === key);

  const groupedVariables = variables.reduce((acc, v) => {
    const isSystem = v.type === 'system' || (!v.type && (v.key.startsWith('ECR_') || v.key.startsWith('ECS_') || v.key === 'AWS_REGION'));
    const isCustom = v.type === 'custom';

    if (isSystem) {
      if (v.key.startsWith('ECR_') || v.key === 'AWS_REGION') {
        if (!acc.ecr.some(existing => existing.key === v.key)) {
          acc.ecr.push(v);
        }
      }
      if (v.key.startsWith('ECS_')) {
        if (!acc.ecs.some(existing => existing.key === v.key)) {
          acc.ecs.push(v);
        }
      }
    } else if (isCustom) {
      acc.custom.push(v);
    }
    return acc;
  }, { ecr: [] as EnvironmentVariable[], ecs: [] as EnvironmentVariable[], custom: [] as EnvironmentVariable[] });

  const onSubmitEcr = (data: EcrFormValues) => {
    saveMutation.mutate({ key: 'ECR_REPOSITORY_NAME', value: data.ecrRepoName, type: 'system' });
    saveMutation.mutate({ key: 'AWS_REGION', value: data.ecrRegion, type: 'system' });
  };

  const onSubmitEcs = (data: EcsFormValues) => {
    saveMutation.mutate({ key: 'ECS_CLUSTER_NAME', value: data.ecsClusterName, type: 'system' });
    saveMutation.mutate({ key: 'ECS_SERVICE_NAME', value: data.ecsServiceName, type: 'system' });
    saveMutation.mutate({ key: 'ECS_TASK_NAME', value: data.ecsTaskName, type: 'system' });
    saveMutation.mutate({ key: 'AWS_REGION', value: data.ecsRegion, type: 'system' });
  };

  const onSubmitCustom = (data: { customVars: CustomFormValues[] }) => {
    data.customVars.forEach(v => {
      if (v.key && v.value) {
        const payload = { ...v, type: 'custom' } as Omit<EnvironmentVariable, 'id' | 'lastModified'> & { id?: string };
        saveMutation.mutate(payload);
      }
    });
  };

  const handleDelete = (id: string, key: string) => {
    if (window.confirm(`Are you sure you want to delete the variable '${key}'?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <Layout><div className="p-6">Loading...</div></Layout>;
  if (error) return <Layout><div className="p-6 text-red-500">Error: {error.message}</div></Layout>;

  return (
    <Layout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-2">Environment Variables</h1>
        <p className="text-muted-foreground mb-6">Manage your AWS and custom environment variables for your pipelines.</p>

        <Tabs defaultValue="ecr" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="ecr">ECR</TabsTrigger>
            <TabsTrigger value="ecs">ECS</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="ecr">
            <Card>
              <CardHeader>
                <CardTitle>ECR Configuration</CardTitle>
                <CardDescription>Link your AWS ECR repository for Docker image pushes.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Repository Name</Label>
                  <p className="font-mono text-sm p-2 bg-muted rounded-md">{getVarByKey('ECR_REPOSITORY_NAME')?.value || 'Not Set'}</p>
                </div>
                <div>
                  <Label>AWS Region</Label>
                  <p className="font-mono text-sm p-2 bg-muted rounded-md">{getVarByKey('AWS_REGION')?.value || 'Not Set'}</p>
                </div>
              </CardContent>
              {!showEcrForm && (
                <CardFooter className="flex justify-end">
                  <Button onClick={() => setShowEcrForm(true)}><PlusCircle className="mr-2 h-4 w-4" /> Configure ECR</Button>
                </CardFooter>
              )}
            </Card>

            {showEcrForm && (
              <Card className="mt-4">
                <form onSubmit={handleSubmitEcr(onSubmitEcr)}>
                  <CardHeader><CardTitle>Update ECR Configuration</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ecrRepoName">ECR Repository Name</Label>
                      <Input id="ecrRepoName" {...registerEcr('ecrRepoName')} placeholder="my-app/my-repo" />
                      {ecrErrors.ecrRepoName && <p className="text-sm text-red-500">{ecrErrors.ecrRepoName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ecrRegion">AWS Region</Label>
                      <Input id="ecrRegion" {...registerEcr('ecrRegion')} placeholder="us-east-1" />
                      {ecrErrors.ecrRegion && <p className="text-sm text-red-500">{ecrErrors.ecrRegion.message}</p>}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2">
                    <Button variant="ghost" onClick={() => setShowEcrForm(false)}>Cancel</Button>
                    <Button type="submit" disabled={saveMutation.isPending}><Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? 'Saving...' : 'Save ECR'}</Button>
                  </CardFooter>
                </form>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ecs">
            <Card>
              <CardHeader>
                <CardTitle>ECS Configuration</CardTitle>
                <CardDescription>Configure your AWS ECS deployment target.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[ 'ECS_CLUSTER_NAME', 'ECS_SERVICE_NAME', 'ECS_TASK_NAME', 'AWS_REGION' ].map(key => (
                  <div key={key} className="rounded-md border p-3">
                    <div className="text-xs text-muted-foreground">{key}</div>
                    <div className="font-mono text-sm mt-1">{getVarByKey(key)?.value || 'Not Set'}</div>
                  </div>
                ))}
              </CardContent>
              {!showEcsForm && (
                <CardFooter className="flex justify-end">
                  <Button onClick={() => setShowEcsForm(true)}><PlusCircle className="mr-2 h-4 w-4" /> Configure ECS</Button>
                </CardFooter>
              )}
            </Card>

            {showEcsForm && (
              <Card className="mt-4">
                <form onSubmit={handleSubmitEcs(onSubmitEcs)}>
                  <CardHeader><CardTitle>Update ECS Configuration</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ecsClusterName">ECS Cluster Name</Label>
                      <Input id="ecsClusterName" {...registerEcs('ecsClusterName')} placeholder="my-cluster" />
                      {ecsErrors.ecsClusterName && <p className="text-sm text-red-500">{ecsErrors.ecsClusterName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ecsServiceName">ECS Service Name</Label>
                      <Input id="ecsServiceName" {...registerEcs('ecsServiceName')} placeholder="my-service" />
                      {ecsErrors.ecsServiceName && <p className="text-sm text-red-500">{ecsErrors.ecsServiceName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ecsTaskName">ECS Task Definition Name</Label>
                      <Input id="ecsTaskName" {...registerEcs('ecsTaskName')} placeholder="my-task-definition" />
                      {ecsErrors.ecsTaskName && <p className="text-sm text-red-500">{ecsErrors.ecsTaskName.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ecsRegion">AWS Region</Label>
                      <Input id="ecsRegion" {...registerEcs('ecsRegion')} placeholder="us-east-1" />
                      {ecsErrors.ecsRegion && <p className="text-sm text-red-500">{ecsErrors.ecsRegion.message}</p>}
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2">
                    <Button variant="ghost" onClick={() => setShowEcsForm(false)}>Cancel</Button>
                    <Button type="submit" disabled={saveMutation.isPending}><Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? 'Saving...' : 'Save ECS'}</Button>
                  </CardFooter>
                </form>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="custom">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Custom Variables</CardTitle>
                  <CardDescription>These variables will be available during the CI/CD process.</CardDescription>
                </div>
                {!showCustomForm && (
                  <Button onClick={() => setShowCustomForm(true)}><PlusCircle className="mr-2 h-4 w-4" /> Add Variable</Button>
                )}
              </CardHeader>
              {groupedVariables.custom.length > 0 && !showCustomForm && (
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Key</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Last Modified</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedVariables.custom.map((variable) => (
                          <TableRow key={variable.id!}>
                            <TableCell className="font-mono">{variable.key}</TableCell>
                            <TableCell>{variable.description}</TableCell>
                            <TableCell>{new Date(variable.lastModified!).toLocaleString()}</TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(variable.id!, variable.key)} disabled={deleteMutation.isPending}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
              {groupedVariables.custom.length === 0 && !showCustomForm && (
                 <CardContent>
                    <div className="text-center py-12">
                        <h3 className="text-lg font-semibold">No Custom Variables</h3>
                        <p className="text-muted-foreground">Add custom environment variables for your build process.</p>
                    </div>
                  </CardContent>
              )}
            </Card>

            {showCustomForm && (
              <Card className="mt-4">
                <form onSubmit={handleSubmitCustom(onSubmitCustom)}>
                  <CardHeader><CardTitle>Define Custom Variables</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex items-start space-x-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-grow">
                          <div className="space-y-2">
                            <Label htmlFor={`customVars.${index}.key`}>Key</Label>
                            <Input {...registerCustom(`customVars.${index}.key`)} placeholder="MY_VARIABLE" className={cn(customErrors.customVars?.[index]?.key && 'border-red-500')} />
                            {customErrors.customVars?.[index]?.key && <p className="text-sm text-red-500">{customErrors.customVars?.[index]?.key?.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`customVars.${index}.value`}>Value</Label>
                            <Input type="password" {...registerCustom(`customVars.${index}.value`)} placeholder="Secret Value" className={cn(customErrors.customVars?.[index]?.value && 'border-red-500')} />
                            {customErrors.customVars?.[index]?.value && <p className="text-sm text-red-500">{customErrors.customVars?.[index]?.value?.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`customVars.${index}.description`}>Description (Optional)</Label>
                            <Input {...registerCustom(`customVars.${index}.description`)} placeholder="A short description" />
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="mt-6" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                  <CardFooter className="flex justify-between items-center">
                    <Button type="button" variant="outline" onClick={() => append({ key: '', value: '', description: '' })}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Another
                    </Button>
                    <div className="flex space-x-2">
                      <Button variant="ghost" onClick={() => setShowCustomForm(false)}>Cancel</Button>
                      <Button type="submit" disabled={saveMutation.isPending}><Save className="mr-2 h-4 w-4" /> {saveMutation.isPending ? 'Saving...' : 'Save Variables'}</Button>
                    </div>
                  </CardFooter>
                </form>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Variables;
