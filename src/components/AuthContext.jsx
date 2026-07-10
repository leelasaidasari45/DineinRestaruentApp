import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  const isRegistering = useRef(false);
  const isLoggingIn = useRef(false);
  const activeUserIdRef = useRef(null);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        verifyRestaurantRole(session.user);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isRegistering.current || isLoggingIn.current) {
        // Skip verification while registering or logging in
        return;
      }
      if (session?.user) {
        verifyRestaurantRole(session.user);
      } else {
        setUser(null);
        setRestaurant(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const verifyRestaurantRole = async (authUser) => {
    // If the user is already loaded and verified, skip fetching to prevent tab-switching flash
    if (activeUserIdRef.current === authUser.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Check if this user ID exists as id OR owner_id in the restaurants table
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .or(`id.eq.${authUser.id},owner_id.eq.${authUser.id}`)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        // Check if they exist in the customers table to determine the message
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (customerData) {
          toast.error('Access Denied: You are registered as a customer, not a restaurant partner.');
        } else {
          toast.error('No restaurant account found. Please sign up to start.');
        }
        
        await supabase.auth.signOut();
        setUser(null);
        setRestaurant(null);
        activeUserIdRef.current = null;
      } else {
        setUser(authUser);
        setRestaurant(data);
        activeUserIdRef.current = authUser.id;
      }
    } catch (err) {
      console.error('Role verification failed:', err);
      await supabase.auth.signOut();
      activeUserIdRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    isLoggingIn.current = true;
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        throw error;
      }
      
      // Check if this user ID exists as id OR owner_id in the restaurants table
      const { data: restaurantData, error: restaurantError } = await supabase
        .from('restaurants')
        .select('*')
        .or(`id.eq.${data.user.id},owner_id.eq.${data.user.id}`)
        .limit(1)
        .maybeSingle();
        
      if (restaurantError || !restaurantData) {
        // Check if they exist in the customers table to determine message
        const { data: customerData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', data.user.id)
          .single();
          
        await supabase.auth.signOut();
        
        if (customerData) {
          throw new Error('Access Denied: You are registered as a customer, not a restaurant partner.');
        } else {
          throw new Error('No restaurant account found. Please sign up to start.');
        }
      }
      
      setUser(data.user);
      setRestaurant(restaurantData);
      activeUserIdRef.current = data.user.id;
      return data;
    } finally {
      isLoggingIn.current = false;
    }
  };

  const register = async (email, password, restaurantName, imageFile) => {
    isRegistering.current = true;
    try {
      // 1. Sign up the user, sending metadata role to satisfy the trigger
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: 'restaurant_owner',
            full_name: restaurantName
          }
        }
      });
      
      if (error) {
        throw error;
      }
      
      if (data.user) {
        let photoUrl = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=500';
        
        if (imageFile) {
          try {
            const fileExt = imageFile.name.split('.').pop();
            const fileName = `${data.user.id}-${Date.now()}.${fileExt}`;
            
            const { error: uploadError } = await supabase.storage
              .from('restaurants')
              .upload(fileName, imageFile, {
                cacheControl: '3600',
                upsert: true
              });
              
            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('restaurants')
                .getPublicUrl(fileName);
              photoUrl = publicUrl;
            } else {
              console.error('Storage upload failed, falling back to base64:', uploadError);
              photoUrl = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(imageFile);
              });
            }
          } catch (uploadErr) {
            console.error('Failed to upload image:', uploadErr);
          }
        }

        // 2. Explicitly store owner in public.restaurant_owners table
        const { error: ownerError } = await supabase
          .from('restaurant_owners')
          .upsert({
            id: data.user.id,
            name: restaurantName,
            email: email,
            created_at: new Date().toISOString()
          });

        if (ownerError) {
          console.error('Failed to insert into restaurant_owners:', ownerError.message);
        }

        // 3. Insert or update the restaurant profile
        // The database trigger handle_new_user might have auto-seeded a restaurant.
        // Let's check if a restaurant with owner_id = user.id exists:
        const { data: existingRestaurant } = await supabase
          .from('restaurants')
          .select('id')
          .eq('owner_id', data.user.id)
          .maybeSingle();

        if (existingRestaurant) {
          // Update the auto-seeded restaurant with the correct name and uploaded photo
          const { error: updateError } = await supabase
            .from('restaurants')
            .update({
              name: restaurantName,
              photo_url: photoUrl
            })
            .eq('id', existingRestaurant.id);

          if (updateError) throw updateError;
        } else {
          // If no auto-seeded restaurant exists, insert a new one
          const { error: insertError } = await supabase
            .from('restaurants')
            .insert([{
              id: data.user.id,
              owner_id: data.user.id,
              name: restaurantName,
              photo_url: photoUrl,
              is_open: true,
              avg_prep_time_minutes: 15
            }]);
            
          if (insertError) {
            throw insertError;
          }
        }
        
        // 4. Verification step manually now that insert/update is complete
        await verifyRestaurantRole(data.user);
      }
      return data;
    } finally {
      isRegistering.current = false;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    activeUserIdRef.current = null;
  };

  const refreshRestaurant = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .or(`id.eq.${user.id},owner_id.eq.${user.id}`)
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setRestaurant(data);
      }
    } catch (e) {
      console.error('Failed to refresh restaurant details:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, restaurant, loading, login, register, logout, refreshRestaurant }}>
      {children}
    </AuthContext.Provider>
  );
};
